import { createHash } from "node:crypto";
import type { GeoJsonGeometry } from "./areaGeometry";
import {
	containPoint,
	geometryBounds,
	pointInBounds,
	type Coordinate,
	type PointContainment,
} from "./areaContainment";
import { boundaryDistanceFinder } from "./areaDistance";
import type { GeographyResolver } from "./geographyResolver";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";
import { countryRelease } from "./pointLookup";
import { DEFAULT_POSTCODE_GEOGRAPHIES } from "./postcodeRoutes";
import { rankReleases } from "./postcodeValue";
import type { PostcodeIndex, PostcodeIndexArtifact } from "./postcodes";
import { compareCodeUnits, findSorted } from "./sortedIndex";

/**
 * The areas every postcode's centroid falls in, compiled for the boundary
 * releases postcode answers read most: the releases a default lookup selects
 * at the directory's edition, the release each measure source's codes are
 * found in, and the country release that settles a postcode matching nothing.
 *
 * A live lookup reads a whole release's geometry, some hundreds of megabytes,
 * to place one point. Here the build places every postcode once, by the same
 * containment test and the same distance to the nearest edge, so a postcode
 * answer reads a few kilobytes and loads no geometry. A release this index
 * does not hold is still answered live.
 *
 * Shards follow the postcode index's districts and align with its shards
 * position by position; each records the hash of the postcode shard it was
 * compiled against, and the manifest records every input it was compiled
 * from, so a stale index is refused rather than served.
 */
export type PostcodeAreasArtifact = {
	schemaVersion: 1;
	contentHash: string;
	/** The postcode index whose centroids were placed. */
	postcodeIndex: string;
	releases: PostcodeAreaRelease[];
	/** Sorted by district. */
	shards: Array<{ district: string; path: string; contentHash: string }>;
};

export type PostcodeAreaPurpose =
	"default-lookup" | "measure-source" | "country";

export type PostcodeAreaRelease = {
	geography: string;
	boundaryRelease: string;
	/** Why the release is compiled. */
	purposes: PostcodeAreaPurpose[];
	/** The area release artifact's content hash. */
	areaRelease: string;
	/** The raw geometry's SHA-256, as the geometry source registry records it. */
	geometryInput: string;
	counts: {
		/** Postcodes whose centroid lies in at least one area. */
		placed: number;
		/** Postcodes with a centroid lying in no area. */
		unplaced: number;
		/** Postcodes on an edge, or in more than one area. */
		several: number;
	};
};

/** One release's placements for one district, a column per field. */
export type PostcodeAreaColumn = {
	/** The area codes the district's postcodes fall in, sorted. */
	codes: string[];
	/**
	 * For each postcode, the position in `codes` of the one area whose
	 * interior holds it; NONE where no area does or it has no centroid, and
	 * SEVERAL where `several` lists its areas.
	 */
	area: number[];
	/** Hundredths of a metre from the centroid to that area's nearest edge. */
	distanceCm: number[];
	/** By postcode position: each area as [code position, containment, distance]. */
	several?: Record<
		string,
		Array<[number, Exclude<PointContainment, "outside">, number]>
	>;
};

export type PostcodeAreasShard = {
	schemaVersion: 1;
	district: string;
	/** The content hash of the postcode shard these columns align with. */
	postcodeShard: string;
	/** Keyed by `{geography}/{boundaryRelease}`. */
	releases: Record<string, PostcodeAreaColumn>;
};

export const NONE = -1;
export const SEVERAL = -2;

export type PostcodeAreaMatch = {
	code: string;
	containment: Exclude<PointContainment, "outside">;
	distanceToBoundaryM: number;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

export const releaseKey = (geography: string, boundaryRelease: string) =>
	`${geography}/${boundaryRelease}`;

/**
 * Every point's placements in one release, as a flat column over all points:
 * each point's areas by the release's code order, with distances in
 * hundredths of a metre. A missing point is placed nowhere.
 */
export type ReleasePlacements = {
	codes: string[];
	area: Int32Array;
	distanceCm: Int32Array;
	several: Map<
		number,
		Array<[number, Exclude<PointContainment, "outside">, number]>
	>;
};

const GRID_DEGREES = 0.01;
const BOUNDS_SLACK_DEGREES = 1e-9;

const cellOf = (value: number, origin: number) =>
	Math.floor((value + origin) / GRID_DEGREES);

export const toCentimetres = (metres: number) => Math.round(metres * 100);

/**
 * Place points in one release's areas. Rather than search the release for
 * each point, each area searches the points inside its bounds, so a release's
 * geometry is walked once. The test is the live lookup's: a point within an
 * area's bounds that the area's rings contain, on an edge included.
 */
export const placePoints = (
	longitudes: Float64Array,
	latitudes: Float64Array,
	codes: string[],
	geometryOf: (code: string) => GeoJsonGeometry | undefined,
): ReleasePlacements => {
	const count = longitudes.length;
	const sorted = [...codes].sort(compareCodeUnits);
	const cells = new Map<number, number[]>();
	for (let at = 0; at < count; at += 1) {
		const longitude = longitudes[at]!;
		if (Number.isNaN(longitude)) continue;
		const key =
			cellOf(longitude, 180) * 100_000 + cellOf(latitudes[at]!, 90);
		const members = cells.get(key);
		if (members) members.push(at);
		else cells.set(key, [at]);
	}
	const found: Array<
		| Array<[number, Exclude<PointContainment, "outside">, number]>
		| undefined
	> = new Array(count);
	sorted.forEach((code, codeAt) => {
		const geometry = geometryOf(code);
		if (!geometry) return;
		const bounds = geometryBounds(geometry);
		if (!bounds) return;
		const west = cellOf(bounds[0] - BOUNDS_SLACK_DEGREES, 180);
		const east = cellOf(bounds[2] + BOUNDS_SLACK_DEGREES, 180);
		const south = cellOf(bounds[1] - BOUNDS_SLACK_DEGREES, 90);
		const north = cellOf(bounds[3] + BOUNDS_SLACK_DEGREES, 90);
		let nearestEdgeM: ((point: Coordinate) => number) | undefined;
		for (let x = west; x <= east; x += 1)
			for (let y = south; y <= north; y += 1) {
				const members = cells.get(x * 100_000 + y);
				if (!members) continue;
				for (const at of members) {
					const point: Coordinate = [longitudes[at]!, latitudes[at]!];
					if (!pointInBounds(point, bounds)) continue;
					const containment = containPoint(point, geometry);
					if (containment === "outside") continue;
					const entry: [
						number,
						Exclude<PointContainment, "outside">,
						number,
					] = [
						codeAt,
						containment,
						toCentimetres(
							(nearestEdgeM ??= boundaryDistanceFinder(geometry))(
								point,
							),
						),
					];
					const existing = found[at];
					if (existing) existing.push(entry);
					else found[at] = [entry];
				}
			}
	});
	const area = new Int32Array(count).fill(NONE);
	const distanceCm = new Int32Array(count);
	const several = new Map<
		number,
		Array<[number, Exclude<PointContainment, "outside">, number]>
	>();
	found.forEach((entries, at) => {
		if (!entries) return;
		if (entries.length === 1 && entries[0]![1] === "interior") {
			area[at] = entries[0]![0];
			distanceCm[at] = entries[0]![2];
			return;
		}
		area[at] = SEVERAL;
		several.set(
			at,
			entries.sort((left, right) => left[0] - right[0]),
		);
	});
	return { codes: sorted, area, distanceCm, several };
};

/** One release's placements for the postcodes at `start` to `end`. */
const columnFor = (
	placements: ReleasePlacements,
	start: number,
	end: number,
): PostcodeAreaColumn => {
	const used = new Set<number>();
	for (let at = start; at < end; at += 1) {
		const area = placements.area[at]!;
		if (area >= 0) used.add(area);
		else if (area === SEVERAL)
			for (const [codeAt] of placements.several.get(at)!)
				used.add(codeAt);
	}
	const local = [...used].sort((left, right) => left - right);
	const position = new Map(local.map((codeAt, index) => [codeAt, index]));
	const area: number[] = [];
	const distanceCm: number[] = [];
	const several: NonNullable<PostcodeAreaColumn["several"]> = {};
	for (let at = start; at < end; at += 1) {
		const global = placements.area[at]!;
		area.push(global >= 0 ? position.get(global)! : global);
		distanceCm.push(placements.distanceCm[at]!);
		if (global === SEVERAL)
			several[at - start] = placements.several
				.get(at)!
				.map(([codeAt, containment, distance]) => [
					position.get(codeAt)!,
					containment,
					distance,
				]);
	}
	return {
		codes: local.map((codeAt) => placements.codes[codeAt]!),
		area,
		distanceCm,
		...(Object.keys(several).length > 0 ? { several } : {}),
	};
};

/** A release's placements read back from the shards of an earlier build. */
export const placementsFromShards = (
	key: string,
	shards: Array<{ offset: number; shard: PostcodeAreasShard }>,
	count: number,
): ReleasePlacements => {
	const codeSet = new Set<string>();
	for (const { shard } of shards)
		for (const code of shard.releases[key]!.codes) codeSet.add(code);
	const codes = [...codeSet].sort(compareCodeUnits);
	const global = new Map(codes.map((code, index) => [code, index]));
	const area = new Int32Array(count).fill(NONE);
	const distanceCm = new Int32Array(count);
	const several: ReleasePlacements["several"] = new Map();
	for (const { offset, shard } of shards) {
		const column = shard.releases[key]!;
		column.area.forEach((local, at) => {
			area[offset + at] =
				local >= 0 ? global.get(column.codes[local]!)! : local;
			distanceCm[offset + at] = column.distanceCm[at]!;
		});
		for (const [at, entries] of Object.entries(column.several ?? {}))
			several.set(
				offset + Number(at),
				entries.map(([local, containment, distance]) => [
					global.get(column.codes[local]!)!,
					containment,
					distance,
				]),
			);
	}
	return { codes, area, distanceCm, several };
};

export const releaseCounts = (
	placements: ReleasePlacements,
	hasPoint: (at: number) => boolean,
): PostcodeAreaRelease["counts"] => {
	const counts = { placed: 0, unplaced: 0, several: 0 };
	placements.area.forEach((area, at) => {
		if (!hasPoint(at)) return;
		if (area === NONE) counts.unplaced += 1;
		else counts.placed += 1;
		if (area === SEVERAL) counts.several += 1;
	});
	return counts;
};

/**
 * Compile releases' placements, each a column over the postcode index's
 * postcodes in shard order, into shards and the manifest that pins them.
 */
export const compilePostcodeAreas = (
	postcodeIndex: PostcodeIndexArtifact,
	releases: Array<{
		release: PostcodeAreaRelease;
		placements: ReleasePlacements;
	}>,
): {
	artifact: PostcodeAreasArtifact;
	files: Array<{ path: string; text: string }>;
} => {
	const files: Array<{ path: string; text: string }> = [];
	const shards: PostcodeAreasArtifact["shards"] = [];
	let offset = 0;
	for (const entry of postcodeIndex.shards) {
		const end = offset + entry.postcodes;
		const shard: PostcodeAreasShard = {
			schemaVersion: 1,
			district: entry.district,
			postcodeShard: entry.contentHash,
			releases: Object.fromEntries(
				releases.map(({ release, placements }) => [
					releaseKey(release.geography, release.boundaryRelease),
					columnFor(placements, offset, end),
				]),
			),
		};
		offset = end;
		const text = `${JSON.stringify(shard)}\n`;
		const path = entry.path.replace(/^postcodes\//, "postcode-areas/");
		files.push({ path, text });
		shards.push({
			district: entry.district,
			path,
			contentHash: sha256(text),
		});
	}
	const body = {
		schemaVersion: 1 as const,
		postcodeIndex: postcodeIndex.contentHash,
		releases: releases
			.map(({ release }) => release)
			.sort((left, right) =>
				compareCodeUnits(
					releaseKey(left.geography, left.boundaryRelease),
					releaseKey(right.geography, right.boundaryRelease),
				),
			),
		shards,
	};
	return {
		artifact: { ...body, contentHash: sha256(JSON.stringify(body)) },
		files,
	};
};

/**
 * Whether a manifest can be served with this postcode index and these inputs.
 * Undefined when it can.
 */
export const postcodeAreasMismatch = (
	artifact: PostcodeAreasArtifact,
	postcodeIndex: PostcodeIndexArtifact,
	inputs: {
		areaRelease: (
			geography: string,
			boundaryRelease: string,
		) => string | undefined;
		geometryInput: (
			geography: string,
			boundaryRelease: string,
		) => string | undefined;
	},
): string | undefined => {
	if (
		artifact.schemaVersion !== 1 ||
		!Array.isArray(artifact.releases) ||
		!Array.isArray(artifact.shards)
	)
		return "is malformed";
	const { contentHash, ...body } = artifact;
	if (sha256(JSON.stringify(body)) !== contentHash)
		return "does not match its own content hash";
	if (artifact.postcodeIndex !== postcodeIndex.contentHash)
		return "was not compiled from the current postcode index";
	for (const release of artifact.releases) {
		const key = releaseKey(release.geography, release.boundaryRelease);
		if (
			inputs.areaRelease(release.geography, release.boundaryRelease) !==
			release.areaRelease
		)
			return `was not compiled from the current areas of ${key}`;
		if (
			inputs.geometryInput(release.geography, release.boundaryRelease) !==
			release.geometryInput
		)
			return `was not compiled from the current geometry of ${key}`;
	}
	return undefined;
};

/** Precompiled placements of unit postcodes, a few districts at a time. */
export class PostcodeAreaIndex {
	private readonly shards = new Map<string, PostcodeAreasShard>();
	private readonly districts: string[];
	private readonly releases: Set<string>;
	private readonly verified = new Set<string>();

	constructor(
		readonly artifact: PostcodeAreasArtifact,
		private readonly postcodes: PostcodeIndex,
		/** The text of a shard at its path in the manifest. */
		private readonly readShard: (path: string) => string,
		/**
		 * How many districts stay in memory. A district's shard holds every
		 * compiled release, some tens of kilobytes parsed.
		 */
		private readonly capacity = 256,
	) {
		this.districts = artifact.shards.map((shard) => shard.district);
		this.releases = new Set(
			artifact.releases.map((release) =>
				releaseKey(release.geography, release.boundaryRelease),
			),
		);
	}

	covers(geography: string, boundaryRelease: string) {
		return this.releases.has(releaseKey(geography, boundaryRelease));
	}

	private shard(district: string): PostcodeAreasShard | undefined {
		const cached = this.shards.get(district);
		if (cached) {
			this.shards.delete(district);
			this.shards.set(district, cached);
			return cached;
		}
		const at = findSorted(this.districts, district);
		if (at === -1) return undefined;
		const entry = this.artifact.shards[at]!;
		const text = this.readShard(entry.path);
		if (!this.verified.has(entry.path)) {
			if (sha256(text) !== entry.contentHash)
				throw new Error(
					`The postcode area shard ${entry.path} does not match the postcode area index. Run pnpm build:postcode-areas.`,
				);
			this.verified.add(entry.path);
		}
		const shard = JSON.parse(text) as PostcodeAreasShard;
		this.shards.set(district, shard);
		if (this.shards.size > this.capacity)
			this.shards.delete(this.shards.keys().next().value!);
		return shard;
	}

	/**
	 * The areas of one release a unit postcode's centroid lies in, ordered by
	 * code, or undefined when this index does not hold that release or
	 * postcode and the answer must be found live.
	 */
	containing(
		postcode: string,
		geography: string,
		boundaryRelease: string,
	): PostcodeAreaMatch[] | undefined {
		const key = releaseKey(geography, boundaryRelease);
		if (!this.releases.has(key)) return undefined;
		const position = this.postcodes.position(postcode);
		if (!position) return undefined;
		const column = this.shard(position.district)?.releases[key];
		if (!column) return undefined;
		const area = column.area[position.at];
		if (area === undefined || area === NONE) return [];
		if (area >= 0)
			return [
				{
					code: column.codes[area]!,
					containment: "interior",
					distanceToBoundaryM: column.distanceCm[position.at]! / 100,
				},
			];
		return (column.several?.[position.at] ?? []).map(
			([codeAt, containment, distance]) => ({
				code: column.codes[codeAt]!,
				containment,
				distanceToBoundaryM: distance / 100,
			}),
		);
	}
}

/**
 * The releases worth compiling: those a postcode answer reads unless told
 * otherwise. A default lookup reads each default geography's release for the
 * directory's edition, and the country release settling a postcode that falls
 * in no area; a postcode value reads each measure source's best release that
 * has geometry. Each is chosen by the rule the answering route applies.
 */
export const postcodeAreaReleases = (
	resolver: GeographyResolver,
	compatibility: MeasureCompatibilityInventory,
	edition: string,
	hasGeometry: (geography: string, boundaryRelease: string) => boolean,
): Array<{
	geography: string;
	boundaryRelease: string;
	purposes: PostcodeAreaPurpose[];
}> => {
	const chosen = new Map<
		string,
		{
			geography: string;
			boundaryRelease: string;
			purposes: Set<PostcodeAreaPurpose>;
		}
	>();
	const choose = (
		geography: string,
		boundaryRelease: string,
		purpose: PostcodeAreaPurpose,
	) => {
		if (
			!resolver.hasAreaRelease(geography, boundaryRelease) ||
			!hasGeometry(geography, boundaryRelease)
		)
			return false;
		const key = releaseKey(geography, boundaryRelease);
		const entry = chosen.get(key) ?? {
			geography,
			boundaryRelease,
			purposes: new Set(),
		};
		entry.purposes.add(purpose);
		chosen.set(key, entry);
		return true;
	};
	for (const geography of DEFAULT_POSTCODE_GEOGRAPHIES) {
		const selected = resolver.selectReleaseForDate(geography, edition);
		if (selected?.status === "selected")
			choose(geography, selected.selected.id, "default-lookup");
	}
	const country = countryRelease(resolver, edition);
	if (country) choose("country", country, "country");
	for (const measure of compatibility.measures)
		for (const source of measure.sources)
			for (const candidate of rankReleases(source.candidates)) {
				const release = resolver.boundaryRelease(
					source.sourceGeography.type,
					candidate.boundaryRelease,
				);
				if (
					release &&
					choose(
						source.sourceGeography.type,
						release.id,
						"measure-source",
					)
				)
					break;
			}
	return [...chosen.values()]
		.map((entry) => ({ ...entry, purposes: [...entry.purposes].sort() }))
		.sort((left, right) =>
			compareCodeUnits(
				releaseKey(left.geography, left.boundaryRelease),
				releaseKey(right.geography, right.boundaryRelease),
			),
		);
};
