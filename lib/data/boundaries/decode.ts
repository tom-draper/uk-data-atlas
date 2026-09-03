import { BoundaryGeojson } from "@lib/types";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";

interface GeoJsonFeatureCollection extends FeatureCollection<
	Geometry,
	GeoJsonProperties
> {
	crs?: {
		type: string;
		properties: {
			name: string;
		};
	};
}

const isTopology = (json: unknown): json is Topology =>
	typeof json === "object" &&
	json !== null &&
	(json as { type?: unknown }).type === "Topology";

/**
 * Normalises a fetched boundary file into a GeoJSON FeatureCollection. The
 * files are TopoJSON, but a plain FeatureCollection is accepted too, so the
 * shape is decided at runtime rather than assumed.
 */
export const decodeBoundaryData = (json: unknown): BoundaryGeojson => {
	let geojson: GeoJsonFeatureCollection;
	if (isTopology(json)) {
		const objectKey = Object.keys(json.objects)[0];
		if (!objectKey)
			throw new Error("TopoJSON contains no geometry objects");

		const result = topojson.feature(json, json.objects[objectKey]);
		geojson =
			result.type === "Feature"
				? { type: "FeatureCollection", features: [result] }
				: result;
	} else {
		geojson = json as GeoJsonFeatureCollection;
	}

	if (!geojson.crs) {
		geojson.crs = {
			type: "name",
			properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
		};
	}

	return geojson as BoundaryGeojson;
};
