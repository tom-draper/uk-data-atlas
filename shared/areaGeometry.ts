import { join } from "node:path";
import { readGeoJsonFeatures, type GeoJsonFeatures } from "./geoJsonProperties";
import {
	canServeAsWgs84,
	geometryProvenance,
	isWgs84,
	toWgs84Geometry,
	toWgs84Packed,
	type GeometryProvenance,
} from "@uk-data-atlas/geography/reprojection";
import {
	appliesTo,
	offsetGeometry,
	readGridOffset,
	type GridOffset,
} from "./gridOffset";
import { readShapefileFeatures } from "./shapefile";
import {
	packedBounds,
	packGeometry,
	roundPacked,
	unpackGeometry,
	type PackedGeometry,
} from "@uk-data-atlas/geography/packed-geometry";
import {
	applyReversedOffsets,
	loadSubstitutions,
	reversedOffsetProvenance,
	substitutionProvenance,
} from "./geometrySubstitution";
import { readGeometryStore } from "./geometryStore";
import type { GeometryValidityReport } from "@uk-data-atlas/geography";
import { spatialCellKey, spatialCells } from "./geometrySpatialIndex";
import {
	borderIndex,
	sharedBorderWith,
	type Neighbour,
} from "./areaNeighbours";
import {
	distanceToBoundsM,
	distanceToGeometryM,
} from "@uk-data-atlas/geography/area-distance";
import {
	boundsIntersect,
	boundsWithin,
	containPoint,
	geometryMeetsBounds,
	pointInBounds,
	type Coordinate,
	type GeometryBounds,
	type PointContainment,
} from "@uk-data-atlas/geography/geometry-point-containment";

import type { GeoJsonGeometry } from "@uk-data-atlas/geography/geometry-types";
export type { GeoJsonGeometry } from "@uk-data-atlas/geography/geometry-types";
export type GeometrySource = {
	input: string;
	/** SHA-256 of the whole source file, when the registry records it. */
	inputHash?: string;
	crs: string;
	codeProperty: string;
	/** Grid corrections the release declares, by definition id. */
	corrections?: string[];
	/**
	 * Geometry substitutions that replace some of the release's areas with
	 * another release's, by definition id (packages/geography).
	 */
	substitutions?: string[];
	/** Grid offsets a WGS84 release carries backwards, undone on load. */
	reversedOffsets?: string[];
};
export type GeometrySourceLookup = Map<string, GeometrySource>;
const isGeometry = (value: unknown): value is GeoJsonGeometry =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as { type?: unknown }).type === "string";
type CachedRelease = {
	identity: string;
	crs: string;
	/**
	 * Areas as published, packed; see packedGeometry.ts. A compiled release
	 * holds them already in WGS84 and decodes each from its file on request.
	 */
	geometries: Pick<Map<string, PackedGeometry>, "get" | "keys">;
	/** Every area's envelope, when the release was compiled with them. */
	storedBounds?: (code: string) => GeometryBounds | undefined;
	storedValidity?: (code: string) => GeometryValidityReport | undefined;
	// Reprojected lazily, one requested area at a time: whole releases can
	// hold millions of vertices, and most requests read a single area. Kept
	// packed, so a release read in full costs its coordinates twice rather
	// than twice its GeoJSON.
	wgs84: Map<string, PackedGeometry>;
	/** WGS84 bounds, built lazily with the geometry used for containment. */
	bounds: Map<string, GeometryBounds | undefined>;
	/** Compact candidate index: codes in fixed grid cells, never copied rings. */
	spatialIndex?: SpatialIndex;
	/** A compiled store reads individual records through this descriptor. */
	close?(): void;
};

type SpatialIndex = {
	codes: string[];
	cellCount: number;
	candidates(bounds: GeometryBounds): Iterable<string>;
};

/**
 * Areas held as GeoJSON after a request read them. Every other area stays
 * packed; this only saves rebuilding the ones a burst of requests shares.
 */
const MATERIALISED_AREAS = 256;

export type ContainingArea = {
	code: string;
	containment: Exclude<PointContainment, "outside">;
};

export type NearbyArea = {
	code: string;
	/** Metres to the area, zero when the point is on or inside it. */
	distanceM: number;
};

export type IntersectingArea = {
	code: string;
	/** `within` when the area lies entirely inside the box. */
	relation: "within" | "overlaps";
	bounds: GeometryBounds;
};
/**
 * Geometry cache activity. Compiled releases retain metadata and indexes,
 * while individual area reads populate the materialised geometry cache.
 * The release limit is a count, not a heap or RSS ceiling.
 */
export type AreaGeometryCacheStats = {
	maxReleases: number;
	loadedReleases: string[];
	/** Area reads answered from a release already in memory. */
	reads: number;
	loads: number;
	/** Of those loads, how many read a compiled release rather than its source. */
	compiledLoads: number;
	/**
	 * Stale compiled stores rejected on load. The field name is retained for
	 * metrics compatibility; serving never falls back to the source file.
	 */
	staleCompiledLoads: number;
	evictions: number;
	loadSeconds: number;
	/** Releases for which the compact point/box candidate index is ready. */
	spatialIndexes: Array<{ release: string; areas: number; cells: number }>;
	spatialIndexBuilds: number;
};

/** The file a compiled release is kept in, within the store directory. */
export const compiledGeometryFile = (
	geography: string,
	boundaryRelease: string,
) => `${geography}-${boundaryRelease}.bin`;

const requireCompiledGeometry = (
	directory: string,
	identity: string,
	source: GeometrySource,
	onStale?: (release: string, path: string) => void,
) => {
	const [geography, boundaryRelease] = identity.split("/") as [
		string,
		string,
	];
	const path = join(
		directory,
		compiledGeometryFile(geography, boundaryRelease),
	);
	try {
		const stored = readGeometryStore(path, source);
		if (stored) return stored;
		onStale?.(identity, path);
		throw new Error(
			"The compiled geometry does not match the registered source.",
		);
	} catch (error) {
		throw new Error(
			`Cannot use compiled geometry for ${identity} at ${path}: ${error instanceof Error ? error.message : String(error)} Remove the unusable compiled file if present, then run pnpm data:build --only geometry-store before starting the API.`,
			{ cause: error },
		);
	}
};

export class AreaGeometryCache {
	private readonly releases = new Map<string, CachedRelease>();
	private readonly offsets = new Map<string, GridOffset>();
	/** Recently read areas as GeoJSON, least recently used first. */
	private readonly materialised = new Map<string, GeoJsonGeometry>();
	private readonly counts = {
		reads: 0,
		loads: 0,
		compiledLoads: 0,
		staleCompiledLoads: 0,
		evictions: 0,
		loadSeconds: 0,
		spatialIndexBuilds: 0,
	};
	constructor(
		private readonly repositoryRoot: string,
		private readonly sources: GeometrySourceLookup,
		private readonly maxReleases = 2,
		/**
		 * Where compiled releases are kept (`data:build --only geometry-store`). A release
		 * must match the registered source. Missing, stale or invalid stores
		 * are refused; omit the directory only for source-based build tools.
		 */
		private readonly storeDirectory?: string,
		/** Told before a stale compiled release is rejected. */
		private readonly onStaleCompiled?: (
			release: string,
			path: string,
		) => void,
		/**
		 * How an area read from a WGS84 source is rounded. Builds that publish
		 * geometry pass `roundKeepingValidity`, so a few areas keep their
		 * source precision; it needs a validator the server doesn't ship.
		 */
		private readonly roundSource: (
			packed: PackedGeometry,
		) => PackedGeometry = roundPacked,
	) {
		if (!Number.isInteger(maxReleases) || maxReleases < 1)
			throw new Error(
				"The geometry cache must hold at least one release.",
			);
		if (storeDirectory)
			for (const [identity, source] of sources)
				requireCompiledGeometry(
					storeDirectory,
					identity,
					source,
					onStaleCompiled,
				).close();
	}
	stats(): AreaGeometryCacheStats {
		return {
			maxReleases: this.maxReleases,
			loadedReleases: [...this.releases.keys()],
			spatialIndexes: [...this.releases.entries()].flatMap(
				([release, cached]) =>
					cached.spatialIndex
						? [
								{
									release,
									areas: cached.spatialIndex.codes.length,
									cells: cached.spatialIndex.cellCount,
								},
							]
						: [],
			),
			...this.counts,
		};
	}
	private source(geography: string, boundaryRelease: string) {
		const identity = [geography, boundaryRelease].join("/");
		const source = this.sources.get(identity);
		if (!source)
			throw new Error(
				"No raw geometry source is available for " + identity + ".",
			);
		if (!canServeAsWgs84(source.crs))
			throw new Error(
				"No transformation to WGS84 is available for geometry in " +
					source.crs +
					".",
			);
		return source;
	}
	/** The declared corrections that move this area, loaded once each. */
	private correctionsFor(source: GeometrySource, code: string): GridOffset[] {
		return (source.corrections ?? [])
			.map((id) => {
				let offset = this.offsets.get(id);
				if (!offset) {
					offset = readGridOffset(this.repositoryRoot, id);
					this.offsets.set(id, offset);
				}
				return offset;
			})
			.filter((offset) => appliesTo(offset, code));
	}
	/** One area in WGS84, packed; reprojected from its source on first use. */
	private wgs84Packed(
		release: CachedRelease,
		geography: string,
		boundaryRelease: string,
		code: string,
		keep = true,
	): PackedGeometry | undefined {
		const packed = release.geometries.get(code);
		if (!packed || isWgs84(release.crs)) return packed;
		const cached = release.wgs84.get(code);
		if (cached) return cached;
		const corrections = this.correctionsFor(
			this.source(geography, boundaryRelease),
			code,
		);
		const reprojected =
			corrections.length === 0
				? toWgs84Packed(packed, release.crs)
				: packGeometry(
						toWgs84Geometry(
							corrections.reduce(
								(moved, offset) =>
									offsetGeometry(offset, moved),
								unpackGeometry(packed),
							),
							release.crs,
						),
					);
		if (keep) release.wgs84.set(code, reprojected);
		return reprojected;
	}

	/**
	 * One area as WGS84 GeoJSON. Reads through `get` keep it for the next
	 * request; internal whole-release passes build it and let it go.
	 */
	private wgs84Geometry(
		release: CachedRelease,
		geography: string,
		boundaryRelease: string,
		code: string,
		cache: boolean,
	): GeoJsonGeometry | undefined {
		const key = `${release.identity}\u0000${code}`;
		const held = this.materialised.get(key);
		if (held) {
			this.materialised.delete(key);
			this.materialised.set(key, held);
			return held;
		}
		const packed = this.wgs84Packed(
			release,
			geography,
			boundaryRelease,
			code,
		);
		if (!packed) return undefined;
		const geometry = unpackGeometry(packed);
		if (cache) {
			this.materialised.set(key, geometry);
			if (this.materialised.size > MATERIALISED_AREAS)
				this.materialised.delete(
					this.materialised.keys().next().value as string,
				);
		}
		return geometry;
	}

	/** One area's WGS84 envelope, read from its packed coordinates. */
	private boundsFor(
		release: CachedRelease,
		geography: string,
		boundaryRelease: string,
		code: string,
	): GeometryBounds | undefined {
		if (release.storedBounds) return release.storedBounds(code);
		if (release.bounds.has(code)) return release.bounds.get(code);
		const packed = this.wgs84Packed(
			release,
			geography,
			boundaryRelease,
			code,
		);
		const bounds = packed ? packedBounds(packed) : undefined;
		release.bounds.set(code, bounds);
		return bounds;
	}

	/** Build the release-local candidate index once, independently of exact reads. */
	private spatialIndexFor(
		geography: string,
		boundaryRelease: string,
	): { release: CachedRelease; index: SpatialIndex } | undefined {
		// Calling get loads and validates the release without requiring a known
		// code; the empty code can never turn into a result.
		this.get(geography, boundaryRelease, "");
		const identity = [geography, boundaryRelease].join("/");
		const release = this.releases.get(identity);
		if (!release) return undefined;
		if (release.spatialIndex)
			return { release, index: release.spatialIndex };
		const cells = new Map<string, string[]>();
		const codes: string[] = [];
		for (const code of release.geometries.keys()) {
			const bounds = this.boundsFor(
				release,
				geography,
				boundaryRelease,
				code,
			);
			if (!bounds) continue;
			codes.push(code);
			for (const cell of spatialCells(bounds) ?? []) {
				const key = spatialCellKey(cell);
				const candidates = cells.get(key) ?? [];
				candidates.push(code);
				cells.set(key, candidates);
			}
		}
		release.spatialIndex = {
			codes,
			cellCount: cells.size,
			candidates: (bounds) => {
				const queryCells = spatialCells(bounds);
				if (queryCells === undefined) return codes;
				const candidates = new Set<string>();
				for (const cell of queryCells)
					for (const code of cells.get(spatialCellKey(cell)) ?? [])
						candidates.add(code);
				return candidates;
			},
		};
		this.counts.spatialIndexBuilds += 1;
		return { release, index: release.spatialIndex };
	}

	private spatialCandidates(
		index: SpatialIndex,
		bounds: GeometryBounds,
	): Iterable<string> {
		return index.candidates(bounds);
	}
	/**
	 * The geometry's source CRS, how it was transformed to WGS84, and, given
	 * an area code, any declared correction that moved that area.
	 */
	provenance(
		geography: string,
		boundaryRelease: string,
		code?: string,
	): GeometryProvenance {
		const source = this.source(geography, boundaryRelease);
		const corrections = [
			...(code === undefined || isWgs84(source.crs)
				? []
				: this.correctionsFor(source, code)
			).map(({ id, description }) => ({ id, description })),
			...(code === undefined
				? []
				: [
						...substitutionProvenance(
							this.sources,
							source.substitutions ?? [],
							code,
						),
						...reversedOffsetProvenance(
							source.reversedOffsets ?? [],
							code,
						),
					]),
		];
		const validity =
			code === undefined
				? undefined
				: this.releases
						.get(`${geography}/${boundaryRelease}`)
						?.storedValidity?.(code);
		return {
			...(source.inputHash
				? { input: source.input, inputHash: source.inputHash }
				: {}),
			...geometryProvenance(source.crs),
			...(corrections.length > 0 ? { corrections } : {}),
			...(validity ? { validity } : {}),
		};
	}
	/** A required compiled release, validated against its registered source. */
	private readCompiled(
		directory: string,
		identity: string,
		geography: string,
		boundaryRelease: string,
	): CachedRelease {
		const stored = requireCompiledGeometry(
			directory,
			identity,
			this.source(geography, boundaryRelease),
			(release, path) => {
				this.counts.staleCompiledLoads += 1;
				this.onStaleCompiled?.(release, path);
			},
		);
		this.counts.compiledLoads += 1;
		return {
			identity,
			crs: "EPSG:4326",
			geometries: { get: stored.get, keys: () => stored.codes.values() },
			storedBounds: stored.bounds,
			storedValidity: stored.validity,
			wgs84: new Map(),
			bounds: new Map(),
			spatialIndex: stored.spatialIndex,
			close: stored.close,
		};
	}
	/** A release read from its publisher's file, as it was registered. */
	private readSource(
		identity: string,
		geography: string,
		boundaryRelease: string,
	): CachedRelease {
		const source = this.source(geography, boundaryRelease);
		const inputPath = join(
			this.repositoryRoot,
			"data/source",
			source.input,
		);
		const data: GeoJsonFeatures = inputPath.toLowerCase().endsWith(".shp")
			? {
					type: "FeatureCollection",
					features: readShapefileFeatures(inputPath),
				}
			: readGeoJsonFeatures(inputPath);
		if (data.type !== "FeatureCollection")
			throw new Error(
				"Geometry source is not a GeoJSON FeatureCollection.",
			);
		const geometries = new Map<string, GeoJsonGeometry>();
		for (const feature of data.features) {
			if (
				typeof feature !== "object" ||
				feature === null ||
				!("geometry" in feature)
			)
				continue;
			const props =
				"properties" in feature ? feature.properties : undefined;
			const value: unknown =
				typeof props === "object" &&
				props !== null &&
				source.codeProperty in props
					? Reflect.get(props, source.codeProperty)
					: undefined;
			if (typeof value !== "string" || !isGeometry(feature.geometry))
				continue;
			const existing = geometries.get(value);
			geometries.set(
				value,
				existing
					? {
							type: "GeometryCollection",
							geometries: [
								...(existing.type === "GeometryCollection"
									? (existing.geometries ?? [])
									: [existing]),
								feature.geometry,
							],
						}
					: feature.geometry,
			);
		}
		if (source.substitutions?.length) {
			// Substituted areas arrive in WGS84, so they can only stand
			// beside geometry that is already in it.
			if (!isWgs84(source.crs))
				throw new Error(
					`${identity}: geometry substitutions need a WGS84 release, not ${source.crs}.`,
				);
			for (const { geometries: donor } of loadSubstitutions(
				this.repositoryRoot,
				this.sources,
				identity,
				source.substitutions,
				geometries.keys(),
			))
				for (const [code, geometry] of donor)
					geometries.set(code, geometry);
		}
		if (source.reversedOffsets?.length) {
			if (!isWgs84(source.crs))
				throw new Error(
					`${identity}: reversed grid offsets need a WGS84 release, not ${source.crs}.`,
				);
			for (const [code, geometry] of geometries)
				geometries.set(
					code,
					applyReversedOffsets(
						this.repositoryRoot,
						source.reversedOffsets,
						code,
						geometry,
					),
				);
		}
		// Reprojection rounds the others to the same precision.
		const wgs84 = isWgs84(source.crs);
		const packed = new Map<string, PackedGeometry>();
		for (const [code, geometry] of geometries)
			packed.set(
				code,
				wgs84
					? this.roundSource(packGeometry(geometry))
					: packGeometry(geometry),
			);
		return {
			identity,
			crs: source.crs,
			geometries: packed,
			wgs84: new Map(),
			bounds: new Map(),
		};
	}
	/**
	 * Every area of a release in WGS84, packed, in source order, for
	 * compiling it. Reprojections are not kept, so a whole release passes
	 * through without being held twice.
	 */
	*compile(
		geography: string,
		boundaryRelease: string,
	): Generator<readonly [string, PackedGeometry]> {
		const identity = [geography, boundaryRelease].join("/");
		const release = this.readSource(identity, geography, boundaryRelease);
		for (const code of release.geometries.keys()) {
			const packed = this.wgs84Packed(
				release,
				geography,
				boundaryRelease,
				code,
				false,
			);
			if (packed) yield [code, packed];
		}
	}
	/** A release, loaded on first use and kept among the most recent. */
	private loaded(geography: string, boundaryRelease: string): CachedRelease {
		const identity = [geography, boundaryRelease].join("/");
		let release = this.releases.get(identity);
		if (!release) {
			const started = performance.now();
			release = this.storeDirectory
				? this.readCompiled(
						this.storeDirectory,
						identity,
						geography,
						boundaryRelease,
					)
				: this.readSource(identity, geography, boundaryRelease);
			this.releases.set(identity, release);
			this.counts.loads += 1;
			this.counts.loadSeconds += (performance.now() - started) / 1000;
			while (this.releases.size > this.maxReleases) {
				const evicted = this.releases.keys().next().value as string;
				const release = this.releases.get(evicted);
				this.releases.delete(evicted);
				release?.close?.();
				for (const key of this.materialised.keys())
					if (key.startsWith(`${evicted}\u0000`))
						this.materialised.delete(key);
				this.counts.evictions += 1;
			}
		} else {
			this.counts.reads += 1;
			this.releases.delete(identity);
			this.releases.set(identity, release);
		}
		return release;
	}
	/** The area's geometry in WGS84, reprojected from its source if needed. */
	get(
		geography: string,
		boundaryRelease: string,
		code: string,
	): GeoJsonGeometry | undefined {
		return this.wgs84Geometry(
			this.loaded(geography, boundaryRelease),
			geography,
			boundaryRelease,
			code,
			true,
		);
	}
	/**
	 * The area in WGS84, packed, and not kept: for a pass over a whole
	 * release, such as writing a download, which needs no GeoJSON.
	 */
	packed(
		geography: string,
		boundaryRelease: string,
		code: string,
	): PackedGeometry | undefined {
		return this.wgs84Packed(
			this.loaded(geography, boundaryRelease),
			geography,
			boundaryRelease,
			code,
			false,
		);
	}
	/** Load releases and their precomputed indexes before accepting traffic. */
	warm(releases: Iterable<readonly [string, string]>): void {
		for (const [geography, boundaryRelease] of releases)
			this.spatialIndexFor(geography, boundaryRelease);
	}
	/**
	 * Every area code the release publishes, in the order its source lists
	 * them. Used to compile a whole release rather than answer for one area.
	 */
	codes(geography: string, boundaryRelease: string): string[] {
		// Calling get loads and validates the release without requiring a known
		// code; the empty code can never turn into a result.
		this.get(geography, boundaryRelease, "");
		const release = this.releases.get(
			[geography, boundaryRelease].join("/"),
		);
		return release ? [...release.geometries.keys()] : [];
	}
	/**
	 * Find areas containing a WGS84 point within one boundary release. A compact
	 * grid index first finds candidate bounds; exact polygon tests preserve the
	 * published boundary semantics, including shared edges and holes.
	 */
	findContaining(
		geography: string,
		boundaryRelease: string,
		point: Coordinate,
	): ContainingArea[] {
		const indexed = this.spatialIndexFor(geography, boundaryRelease);
		if (!indexed) return [];
		const { release, index } = indexed;
		const matches: ContainingArea[] = [];
		for (const code of this.spatialCandidates(index, [
			point[0],
			point[1],
			point[0],
			point[1],
		])) {
			// The envelope settles most candidates without building any rings.
			const bounds = this.boundsFor(
				release,
				geography,
				boundaryRelease,
				code,
			);
			if (!bounds || !pointInBounds(point, bounds)) continue;
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
			const containment = containPoint(point, geometry);
			if (containment !== "outside") matches.push({ code, containment });
		}
		return matches.sort((left, right) =>
			left.code.localeCompare(right.code),
		);
	}

	/**
	 * The areas of one release nearest a WGS84 point, no further than
	 * `withinM`, nearest first. The same compact grid narrows the work to areas
	 * whose envelopes can reach the requested radius.
	 */
	findNearest(
		geography: string,
		boundaryRelease: string,
		point: Coordinate,
		withinM: number,
	): NearbyArea[] {
		const indexed = this.spatialIndexFor(geography, boundaryRelease);
		if (!indexed) return [];
		const { release, index } = indexed;
		const latitudeDelta = withinM / 110000;
		const furthestLatitude = Math.min(
			89.999,
			Math.abs(point[1]) + latitudeDelta,
		);
		const longitudeMetresPerDegree = Math.max(
			0.001,
			110000 * Math.cos((furthestLatitude * Math.PI) / 180),
		);
		const longitudeDelta = withinM / longitudeMetresPerDegree;
		const searchBounds: GeometryBounds = [
			Math.max(-180, point[0] - longitudeDelta),
			Math.max(-90, point[1] - latitudeDelta),
			Math.min(180, point[0] + longitudeDelta),
			Math.min(90, point[1] + latitudeDelta),
		];
		const nearby: NearbyArea[] = [];
		for (const code of this.spatialCandidates(index, searchBounds)) {
			const bounds = this.boundsFor(
				release,
				geography,
				boundaryRelease,
				code,
			);
			if (!bounds || distanceToBoundsM(point, bounds) > withinM) continue;
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
			const distanceM = distanceToGeometryM(point, geometry);
			if (distanceM <= withinM) nearby.push({ code, distanceM });
		}
		return nearby.sort(
			(left, right) =>
				left.distanceM - right.distanceM ||
				left.code.localeCompare(right.code),
		);
	}

	/**
	 * Find areas meeting a WGS84 box within one boundary release.
	 *
	 * Most areas are settled by their cached bounds alone. Bounds that fall
	 * entirely inside the box put the area inside it too, exactly, since an
	 * area never reaches past its own bounds; bounds that miss the box settle
	 * it the other way. Only an area straddling an edge of the box needs its
	 * rings walked, which is a thin band around the box however large the box
	 * is.
	 */
	findIntersecting(
		geography: string,
		boundaryRelease: string,
		box: GeometryBounds,
	): IntersectingArea[] {
		const indexed = this.spatialIndexFor(geography, boundaryRelease);
		if (!indexed) return [];
		const { release, index } = indexed;
		const matches: IntersectingArea[] = [];
		for (const code of this.spatialCandidates(index, box)) {
			const bounds = this.boundsFor(
				release,
				geography,
				boundaryRelease,
				code,
			);
			if (!bounds || !boundsIntersect(bounds, box)) continue;
			if (boundsWithin(bounds, box)) {
				matches.push({ code, relation: "within", bounds });
				continue;
			}
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
			if (geometryMeetsBounds(geometry, box))
				matches.push({ code, relation: "overlaps", bounds });
		}
		return matches.sort((left, right) =>
			left.code.localeCompare(right.code),
		);
	}

	/**
	 * Find the areas whose boundary meets this one's, within one release.
	 *
	 * Only areas whose bounds touch the target's can share anything with it, so
	 * the boundary comparison runs against a handful of candidates rather than
	 * the whole release, and the grid index finds those candidates without
	 * visiting every area's envelope. Nothing here is indexed across every
	 * area's edges, which for a ward release would be millions held to answer
	 * one question.
	 *
	 * Returns undefined when the area itself has no geometry to compare.
	 */
	findNeighbours(
		geography: string,
		boundaryRelease: string,
		code: string,
	): Neighbour[] | undefined {
		const geometry = this.get(geography, boundaryRelease, code);
		if (!geometry) return undefined;
		const indexed = this.spatialIndexFor(geography, boundaryRelease);
		if (!indexed) return undefined;
		const { release, index } = indexed;
		const boundsFor = (forCode: string) =>
			this.boundsFor(release, geography, boundaryRelease, forCode);
		const targetBounds = boundsFor(code);
		if (!targetBounds) return [];
		const target = borderIndex(geometry);
		const neighbours: Neighbour[] = [];
		for (const otherCode of this.spatialCandidates(index, targetBounds)) {
			if (otherCode === code) continue;
			const otherBounds = boundsFor(otherCode);
			// Bounds that only touch still qualify: two areas meeting along a
			// border have bounds that meet there too.
			if (!otherBounds || !boundsIntersect(targetBounds, otherBounds))
				continue;
			const other = this.get(geography, boundaryRelease, otherCode);
			if (!other) continue;
			const shared = sharedBorderWith(target, other);
			if (shared) neighbours.push({ code: otherCode, ...shared });
		}
		return neighbours.sort(
			(left, right) =>
				right.sharedBorderM - left.sharedBorderM ||
				left.code.localeCompare(right.code),
		);
	}
}
