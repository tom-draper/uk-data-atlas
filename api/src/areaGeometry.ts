import { readFileSync } from "node:fs";
import { join } from "node:path";

export type GeoJsonGeometry = {
	type: string;
	coordinates?: unknown;
	geometries?: GeoJsonGeometry[];
};
export type GeometrySource = {
	input: string;
	crs: string;
	codeProperty: string;
};
export type GeometrySourceLookup = Map<string, GeometrySource>;
type Feature = { properties?: unknown; geometry?: unknown };
type Collection = { type?: unknown; features?: Feature[] };
const isGeometry = (value: unknown): value is GeoJsonGeometry =>
	typeof value === "object" &&
	value !== null &&
	typeof (value as { type?: unknown }).type === "string";
const wgs84 = (crs: string) =>
	crs === "EPSG:4326" || crs === "CRS84" || crs.endsWith(":CRS84");
export class AreaGeometryCache {
	private readonly releases = new Map<string, Map<string, GeoJsonGeometry>>();
	constructor(
		private readonly repositoryRoot: string,
		private readonly sources: GeometrySourceLookup,
		private readonly maxReleases = 2,
	) {}
	get(
		geography: string,
		boundaryRelease: string,
		code: string,
	): GeoJsonGeometry | undefined {
		const identity = [geography, boundaryRelease].join("/");
		let geometries = this.releases.get(identity);
		if (!geometries) {
			const source = this.sources.get(identity);
			if (!source)
				throw new Error(
					"No raw GeoJSON geometry source is available for " +
						identity +
						".",
				);
			if (!wgs84(source.crs))
				throw new Error(
					"Geometry source is not yet WGS84-ready: " + source.crs,
				);
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
			geometries = new Map();
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
			this.releases.set(identity, geometries);
			while (this.releases.size > this.maxReleases)
				this.releases.delete(
					this.releases.keys().next().value as string,
				);
		} else {
			this.releases.delete(identity);
			this.releases.set(identity, geometries);
		}
		return geometries.get(code);
	}
}
