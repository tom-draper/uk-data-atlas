import type { GeoJsonGeometry } from "../../shared/areaGeometry";
import {
	containPoint,
	geometryBounds,
	pointInBounds,
	type Coordinate,
	type PointContainment,
} from "@uk-data-atlas/geography/geometry-point-containment";
import { boundaryDistanceFinder } from "../../shared/areaDistance";
import type { PostcodeIndexArtifact } from "../../shared/postcodeIndexTypes";
import { compareCodeUnits } from "../../shared/sortedIndex";
import { sha256 } from "../../shared/contentHash";
import {
	NONE,
	SEVERAL,
	releaseKey,
	type PostcodeAreasArtifact,
	type PostcodeAreaRelease,
	type PostcodeAreaColumn,
	type PostcodeAreasShard,
} from "../../shared/postcodeAreaTypes";
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

/**
 * Releases' placements read back from the shards of an earlier build. The
 * shards are read once, in order, and none is kept: each fills every release
 * with its shard's own code numbers, which become the release's sorted ones
 * once all its codes are known.
 */
export const placementsFromShards = (
	keys: string[],
	shards: Iterable<{ offset: number; shard: PostcodeAreasShard }>,
	count: number,
): Map<string, ReleasePlacements> => {
	const releases = keys.map((key) => ({
		key,
		codes: new Set<string>(),
		ranges: [] as Array<{
			offset: number;
			length: number;
			codes: string[];
		}>,
		area: new Int32Array(count).fill(NONE),
		distanceCm: new Int32Array(count),
		several: new Map<
			number,
			Array<[string, Exclude<PointContainment, "outside">, number]>
		>(),
	}));
	for (const { offset, shard } of shards)
		for (const release of releases) {
			const column = shard.releases[release.key]!;
			for (const code of column.codes) release.codes.add(code);
			release.ranges.push({
				offset,
				length: column.area.length,
				codes: column.codes,
			});
			release.area.set(column.area, offset);
			release.distanceCm.set(column.distanceCm, offset);
			for (const [at, entries] of Object.entries(column.several ?? {}))
				release.several.set(
					offset + Number(at),
					entries.map(([local, containment, distance]) => [
						column.codes[local]!,
						containment,
						distance,
					]),
				);
		}
	return new Map(
		releases.map((release): [string, ReleasePlacements] => {
			const codes = [...release.codes].sort(compareCodeUnits);
			const global = new Map(codes.map((code, index) => [code, index]));
			const { area } = release;
			for (const { offset, length, codes: local } of release.ranges) {
				const numbers = local.map((code) => global.get(code)!);
				for (let at = offset; at < offset + length; at += 1)
					if (area[at]! >= 0) area[at] = numbers[area[at]!]!;
			}
			const several: ReleasePlacements["several"] = new Map();
			for (const [at, entries] of release.several)
				several.set(
					at,
					entries.map(([code, containment, distance]) => [
						global.get(code)!,
						containment,
						distance,
					]),
				);
			return [
				release.key,
				{ codes, area, distanceCm: release.distanceCm, several },
			];
		}),
	);
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
