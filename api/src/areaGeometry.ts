import { readFileSync } from "node:fs";
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
import { borderIndex, sharedBorder, type Neighbour } from "./areaNeighbours";
import { distanceToBoundsM, distanceToGeometryM } from "./areaDistance";
import {
	boundsIntersect,
	boundsWithin,
	containPoint,
	geometryBounds,
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
};
export type GeometrySourceLookup = Map<string, GeometrySource>;
type Feature = { properties?: unknown; geometry?: unknown };
type Collection = { type?: unknown; features?: Feature[] };
const isGeometry = (value: unknown): value is GeoJsonGeometry =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as { type?: unknown }).type === "string";
type CachedRelease = {
	crs: string;
	geometries: Map<string, GeoJsonGeometry>;
	// Reprojected lazily, one requested area at a time: whole releases can
	// hold millions of vertices, and most requests read a single area.
	wgs84: Map<string, GeoJsonGeometry>;
	/** WGS84 bounds, built lazily with the geometry used for containment. */
	bounds: Map<string, GeometryBounds | undefined>;
	/** Compact candidate index: codes in quarter-degree cells, never copied rings. */
	spatialIndex?: SpatialIndex;
};

type SpatialIndex = {
	cells: Map<string, string[]>;
	/** Every code with a usable WGS84 envelope, for deliberately wide queries. */
	codes: string[];
};

const SPATIAL_CELL_DEGREES = 0.25;
const MAX_SPATIAL_QUERY_CELLS = 10_000;

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
 * 60 to 400 MB of heap once read, so the limit is a count of releases, and a
 * rising eviction count says it is too small for the traffic it serves.
 */
export type AreaGeometryCacheStats = {
	maxReleases: number;
	loadedReleases: string[];
	/** Area reads answered from a release already in memory. */
	reads: number;
	loads: number;
	evictions: number;
	loadSeconds: number;
	/** Releases for which the compact point/box candidate index is ready. */
	spatialIndexes: Array<{ release: string; areas: number; cells: number }>;
	spatialIndexBuilds: number;
};

export class AreaGeometryCache {
	private readonly releases = new Map<string, CachedRelease>();
	private readonly offsets = new Map<string, GridOffset>();
	private readonly counts = {
		reads: 0,
		loads: 0,
		evictions: 0,
		loadSeconds: 0,
		spatialIndexBuilds: 0,
	};
	constructor(
		private readonly repositoryRoot: string,
		private readonly sources: GeometrySourceLookup,
		private readonly maxReleases = 2,
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
									cells: cached.spatialIndex.cells.size,
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
	/** Transform one loaded geometry, caching it only when an exact operation needs it. */
	private wgs84Geometry(
		release: CachedRelease,
		geography: string,
		boundaryRelease: string,
		code: string,
		cache: boolean,
	): GeoJsonGeometry | undefined {
		const geometry = release.geometries.get(code);
		if (!geometry || isWgs84(release.crs)) return geometry;
		const cached = release.wgs84.get(code);
		if (cached) return cached;
		const corrected = this.correctionsFor(
			this.source(geography, boundaryRelease),
			code,
		).reduce((moved, offset) => offsetGeometry(offset, moved), geometry);
		const reprojected = toWgs84Geometry(corrected, release.crs);
		if (cache) release.wgs84.set(code, reprojected);
		return reprojected;
	}

	/** Calculate one WGS84 envelope without retaining a second copy of its rings. */
	private boundsFor(
		release: CachedRelease,
		geography: string,
		boundaryRelease: string,
		code: string,
	): GeometryBounds | undefined {
		if (release.bounds.has(code)) return release.bounds.get(code);
		const geometry = this.wgs84Geometry(
			release,
			geography,
			boundaryRelease,
			code,
			false,
		);
		const bounds = geometry ? geometryBounds(geometry) : undefined;
		release.bounds.set(code, bounds);
		return bounds;
	}

	private cellRange(bounds: GeometryBounds) {
		const west = Math.max(-180, bounds[0]);
		const south = Math.max(-90, bounds[1]);
		const east = Math.min(180, bounds[2]);
		const north = Math.min(90, bounds[3]);
		if (west > east || south > north) return undefined;
		return {
			west: Math.floor((west + 180) / SPATIAL_CELL_DEGREES),
			south: Math.floor((south + 90) / SPATIAL_CELL_DEGREES),
			east: Math.floor((east + 180) / SPATIAL_CELL_DEGREES),
			north: Math.floor((north + 90) / SPATIAL_CELL_DEGREES),
		};
	}

	private cellKeys(bounds: GeometryBounds): string[] | undefined {
		const range = this.cellRange(bounds);
		if (!range) return [];
		const count =
			(range.east - range.west + 1) * (range.north - range.south + 1);
		if (count > MAX_SPATIAL_QUERY_CELLS) return undefined;
		const keys: string[] = [];
		for (let longitude = range.west; longitude <= range.east; longitude++)
			for (
				let latitude = range.south;
				latitude <= range.north;
				latitude++
			)
				keys.push(`${longitude}/${latitude}`);
		return keys;
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
			for (const key of this.cellKeys(bounds) ?? []) {
				const candidates = cells.get(key) ?? [];
				candidates.push(code);
				cells.set(key, candidates);
			}
		}
		release.spatialIndex = { cells, codes };
		this.counts.spatialIndexBuilds += 1;
		return { release, index: release.spatialIndex };
	}

	private spatialCandidates(
		index: SpatialIndex,
		bounds: GeometryBounds,
	): Iterable<string> {
		const keys = this.cellKeys(bounds);
		if (keys === undefined) return index.codes;
		const candidates = new Set<string>();
		for (const key of keys)
			for (const code of index.cells.get(key) ?? []) candidates.add(code);
		return candidates;
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
		const corrections =
			code === undefined || isWgs84(source.crs)
				? []
				: this.correctionsFor(source, code);
		return {
			...(source.inputHash
				? { input: source.input, inputHash: source.inputHash }
				: {}),
			...geometryProvenance(source.crs),
			...(corrections.length > 0
				? {
						corrections: corrections.map(({ id, description }) => ({
							id,
							description,
						})),
					}
				: {}),
		};
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
			const source = this.source(geography, boundaryRelease);
			const inputPath = join(this.repositoryRoot, "data", source.input);
			const data: Collection = inputPath.toLowerCase().endsWith(".shp")
				? {
						type: "FeatureCollection",
						features: readShapefileFeatures(inputPath),
					}
				: (JSON.parse(readFileSync(inputPath, "utf8")) as Collection);
			if (
				data.type !== "FeatureCollection" ||
				!Array.isArray(data.features)
			)
				throw new Error(
					"Geometry source is not a GeoJSON FeatureCollection.",
				);
			const geometries = new Map<string, GeoJsonGeometry>();
			for (const feature of data.features) {
				const props = feature.properties;
				const value =
					typeof props === "object" && props !== null
						? (props as Record<string, unknown>)[
								source.codeProperty
							]
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
			release = {
				crs: source.crs,
				geometries,
				wgs84: new Map(),
				bounds: new Map(),
			};
			this.releases.set(identity, release);
			this.counts.loads += 1;
			this.counts.loadSeconds += (performance.now() - started) / 1000;
			while (this.releases.size > this.maxReleases) {
				this.releases.delete(
					this.releases.keys().next().value as string,
				);
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
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
			const bounds = this.boundsFor(
				release,
				geography,
				boundaryRelease,
				code,
			);
			if (!bounds || !pointInBounds(point, bounds)) continue;
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
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
			const bounds = this.boundsFor(
				release,
				geography,
				boundaryRelease,
				code,
			);
			if (!bounds || distanceToBoundsM(point, bounds) > withinM) continue;
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
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
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
		const boundsFor = (forCode: string, forGeometry: GeoJsonGeometry) => {
			let bounds = release.bounds.get(forCode);
			if (bounds === undefined && !release.bounds.has(forCode)) {
				bounds = geometryBounds(forGeometry);
				release.bounds.set(forCode, bounds);
			}
			return bounds;
		};
		const targetBounds = boundsFor(code, geometry);
		if (!targetBounds) return [];
		const target = borderIndex(geometry);
		const neighbours: Neighbour[] = [];
		for (const otherCode of release.geometries.keys()) {
			if (otherCode === code) continue;
			const other = this.get(geography, boundaryRelease, otherCode);
			if (!other) continue;
			const otherBounds = boundsFor(otherCode, other);
			// Bounds that only touch still qualify: two areas meeting along a
			// border have bounds that meet there too.
			if (!otherBounds || !boundsIntersect(targetBounds, otherBounds))
				continue;
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
