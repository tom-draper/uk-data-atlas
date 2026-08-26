import { BoundaryGeojson } from "@lib/types";
import * as topojson from "topojson-client";
import {
	Feature,
	FeatureCollection,
	GeoJsonProperties,
	Geometry,
} from "geojson";

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

export const decodeBoundaryData = (json: any): BoundaryGeojson => {
	let geojson: GeoJsonFeatureCollection;
	if (json.type === "Topology") {
		const objectKey = Object.keys(json.objects)[0];
		if (!objectKey)
			throw new Error("TopoJSON contains no geometry objects");

		const result:
			| Feature<Geometry, GeoJsonProperties>
			| FeatureCollection<Geometry, GeoJsonProperties> = topojson.feature(
			json,
			json.objects[objectKey] as any,
		);
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
