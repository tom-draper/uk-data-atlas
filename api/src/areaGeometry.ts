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

export type GeoJsonGeometry = {
	type: string;
	coordinates?: unknown;
	geometries?: GeoJsonGeometry[];
};
export type GeometrySource = {
	input: string;
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
				"No raw GeoJSON geometry source is available for " +
					identity +
					".",
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
			const data = JSON.parse(
				readFileSync(
					join(this.repositoryRoot, "data", source.input),
					"utf8",
				),
			) as Collection;
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
			release = { crs: source.crs, geometries, wgs84: new Map() };
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
}
