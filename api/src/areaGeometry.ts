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
};

export type ContainingArea = {
	code: string;
	containment: Exclude<PointContainment, "outside">;
};

export type IntersectingArea = {
	code: string;
	/** `within` when the area lies entirely inside the box. */
	relation: "within" | "overlaps";
	bounds: GeometryBounds;
};
export class AreaGeometryCache {
	private readonly releases = new Map<string, CachedRelease>();
	private readonly offsets = new Map<string, GridOffset>();
	constructor(
		private readonly repositoryRoot: string,
		private readonly sources: GeometrySourceLookup,
		private readonly maxReleases = 2,
	) {}
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
			while (this.releases.size > this.maxReleases)
				this.releases.delete(
					this.releases.keys().next().value as string,
				);
		} else {
			this.releases.delete(identity);
			this.releases.set(identity, release);
		}
		const geometry = release.geometries.get(code);
		if (!geometry || isWgs84(release.crs)) return geometry;
		let reprojected = release.wgs84.get(code);
		if (!reprojected) {
			// A declared correction moves the area in the publisher's own
			// grid, before it is reprojected.
			const corrected = this.correctionsFor(
				this.source(geography, boundaryRelease),
				code,
			).reduce(
				(moved, offset) => offsetGeometry(offset, moved),
				geometry,
			);
			reprojected = toWgs84Geometry(corrected, release.crs);
			release.wgs84.set(code, reprojected);
		}
		return reprojected;
	}
	/**
	 * Find areas containing a WGS84 point within one boundary release. Bounds are
	 * cached before the exact polygon test, so repeated map clicks avoid scanning
	 * every ring of every feature.
	 */
	findContaining(
		geography: string,
		boundaryRelease: string,
		point: Coordinate,
	): ContainingArea[] {
		// Calling get loads and validates the release without requiring a known
		// code; the empty code can never turn into a result.
		this.get(geography, boundaryRelease, "");
		const identity = [geography, boundaryRelease].join("/");
		const release = this.releases.get(identity);
		if (!release) return [];
		const matches: ContainingArea[] = [];
		for (const code of release.geometries.keys()) {
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
			let bounds = release.bounds.get(code);
			if (bounds === undefined && !release.bounds.has(code)) {
				bounds = geometryBounds(geometry);
				release.bounds.set(code, bounds);
			}
			if (!bounds || !pointInBounds(point, bounds)) continue;
			const containment = containPoint(point, geometry);
			if (containment !== "outside") matches.push({ code, containment });
		}
		return matches.sort((left, right) =>
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
		// As in findContaining: load and validate the release without needing
		// a known code.
		this.get(geography, boundaryRelease, "");
		const identity = [geography, boundaryRelease].join("/");
		const release = this.releases.get(identity);
		if (!release) return [];
		const matches: IntersectingArea[] = [];
		for (const code of release.geometries.keys()) {
			const geometry = this.get(geography, boundaryRelease, code);
			if (!geometry) continue;
			let bounds = release.bounds.get(code);
			if (bounds === undefined && !release.bounds.has(code)) {
				bounds = geometryBounds(geometry);
				release.bounds.set(code, bounds);
			}
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
