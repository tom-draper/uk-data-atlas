import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	canServeAsWgs84,
	geometryProvenance,
	isWgs84,
	toWgs84Geometry,
	type GeometryProvenance,
} from "./reprojection";
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
	unpackGeometry,
	type PackedGeometry,
} from "./packedGeometry";
import {
	applyReversedOffsets,
	loadSubstitutions,
	reversedOffsetProvenance,
	substitutionProvenance,
} from "./geometrySubstitution";
import { readGeometryStore } from "./geometryStore";
import { spatialCellKey, spatialCells } from "./geometrySpatialIndex";
import { borderIndex, sharedBorder, type Neighbour } from "./areaNeighbours";
import { distanceToBoundsM, distanceToGeometryM } from "./areaDistance";
import {
	boundsIntersect,
	boundsWithin,
	containPoint,
	geometryMeetsBounds,
	pointInBounds,
	type Coordinate,
	type GeometryBounds,
	type PointContainment,
} from "./areaContainment";

export type GeoJsonGeometry = {
	type: string;
	coordinates?: unknown;
	geometries?: GeoJsonGeometry[];
};
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
type Feature = { properties?: unknown; geometry?: unknown };
type Collection = { type?: unknown; features?: Feature[] };
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
 * How the geometry cache has behaved since the server started. A release costs
 * some 10 to 200 MB of heap once read, its coordinates packed, so the limit is
 * a count of releases, and a rising eviction count says it is too small for
 * the traffic it serves.
 */
export type AreaGeometryCacheStats = {
	maxReleases: number;
	loadedReleases: string[];
	/** Area reads answered from a release already in memory. */
	reads: number;
	loads: number;
	/** Of those loads, how many read a compiled release rather than its source. */
	compiledLoads: number;
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

export class AreaGeometryCache {
	private readonly releases = new Map<string, CachedRelease>();
	private readonly offsets = new Map<string, GridOffset>();
	/** Recently read areas as GeoJSON, least recently used first. */
	private readonly materialised = new Map<string, GeoJsonGeometry>();
	private readonly counts = {
		reads: 0,
		loads: 0,
		compiledLoads: 0,
		evictions: 0,
		loadSeconds: 0,
		spatialIndexBuilds: 0,
	};
	constructor(
		private readonly repositoryRoot: string,
		private readonly sources: GeometrySourceLookup,
		private readonly maxReleases = 2,
		/**
		 * Where compiled releases are kept (`build:geometry-store`). A release
		 * compiled there from its current source is read from it; any other
		 * is read from its source.
		 */
		private readonly storeDirectory?: string,
	) {
		if (!Number.isInteger(maxReleases) || maxReleases < 1)
			throw new Error(
				"The geometry cache must hold at least one release.",
			);
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
		const corrected = this.correctionsFor(
			this.source(geography, boundaryRelease),
			code,
		).reduce(
			(moved, offset) => offsetGeometry(offset, moved),
			unpackGeometry(packed),
		);
		const reprojected = packGeometry(
			toWgs84Geometry(corrected, release.crs),
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
		return {
			...(source.inputHash
				? { input: source.input, inputHash: source.inputHash }
				: {}),
			...geometryProvenance(source.crs),
			...(corrections.length > 0 ? { corrections } : {}),
		};
	}
	/** A compiled release of this area set, if one is current. */
	private readCompiled(
		identity: string,
		geography: string,
		boundaryRelease: string,
	): CachedRelease | undefined {
		if (!this.storeDirectory) return undefined;
		const path = join(
			this.storeDirectory,
			compiledGeometryFile(geography, boundaryRelease),
		);
		if (!existsSync(path)) return undefined;
		const stored = readGeometryStore(
			path,
			this.source(geography, boundaryRelease),
		);
		if (!stored) return undefined;
		this.counts.compiledLoads += 1;
		return {
			identity,
			crs: "EPSG:4326",
			geometries: { get: stored.get, keys: () => stored.codes.values() },
			storedBounds: stored.bounds,
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
		const inputPath = join(this.repositoryRoot, "data", source.input);
		const data: Collection = inputPath.toLowerCase().endsWith(".shp")
			? {
					type: "FeatureCollection",
					features: readShapefileFeatures(inputPath),
				}
			: (JSON.parse(readFileSync(inputPath, "utf8")) as Collection);
		if (data.type !== "FeatureCollection" || !Array.isArray(data.features))
			throw new Error(
				"Geometry source is not a GeoJSON FeatureCollection.",
			);
		const geometries = new Map<string, GeoJsonGeometry>();
		for (const feature of data.features) {
			const props = feature.properties;
			const value =
				typeof props === "object" && props !== null
					? (props as Record<string, unknown>)[source.codeProperty]
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
		const packed = new Map<string, PackedGeometry>();
		for (const [code, geometry] of geometries)
			packed.set(code, packGeometry(geometry));
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
	/** The area's geometry in WGS84, reprojected from its source if needed. */
	get(
		geography: string,
		boundaryRelease: string,
		code: string,
	): GeoJsonGeometry | undefined {
		const identity = [geography, boundaryRelease].join("/");
		let release = this.releases.get(identity);
		if (!release) {
			const started = performance.now();
			release =
				this.readCompiled(identity, geography, boundaryRelease) ??
				this.readSource(identity, geography, boundaryRelease);
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
		return this.wgs84Geometry(
			release,
			geography,
			boundaryRelease,
			code,
			true,
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
	 * the whole release. Nothing here is indexed across every area, which for a
	 * ward release would be millions of edges held to answer one question.
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
		const identity = [geography, boundaryRelease].join("/");
		const release = this.releases.get(identity);
		if (!release) return undefined;
		const boundsFor = (forCode: string) =>
			this.boundsFor(release, geography, boundaryRelease, forCode);
		const targetBounds = boundsFor(code);
		if (!targetBounds) return [];
		const target = borderIndex(geometry);
		const neighbours: Neighbour[] = [];
		for (const otherCode of release.geometries.keys()) {
			if (otherCode === code) continue;
			const otherBounds = boundsFor(otherCode);
			// Bounds that only touch still qualify: two areas meeting along a
			// border have bounds that meet there too.
			if (!otherBounds || !boundsIntersect(targetBounds, otherBounds))
				continue;
			const other = this.get(geography, boundaryRelease, otherCode);
			if (!other) continue;
			const shared = sharedBorder(target, borderIndex(other));
			if (shared) neighbours.push({ code: otherCode, ...shared });
		}
		return neighbours.sort(
			(left, right) =>
				right.sharedBorderM - left.sharedBorderM ||
				left.code.localeCompare(right.code),
		);
	}
}
