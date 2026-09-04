import { describe, expect, it } from "vitest";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";

describe("decodeBoundaryData", () => {
	it("wraps a lone geometry as a one-feature collection, with the CRS map layers expect", () => {
		const boundary = decodeBoundaryData({
			type: "Topology",
			transform: { scale: [1, 1], translate: [0, 0] },
			arcs: [
				[
					[0, 0],
					[1, 0],
					[0, 1],
					[-1, 0],
					[0, -1],
				],
			],
			objects: {
				area: {
					type: "Polygon",
					arcs: [[0]],
				},
			},
		});

		expect(boundary.type).toBe("FeatureCollection");
		expect(boundary.features).toHaveLength(1);
		expect(boundary.crs.properties.name).toBe(
			"urn:ogc:def:crs:OGC:1.3:CRS84",
		);
	});

	it("expands a geometry collection into one feature per area", () => {
		const boundary = decodeBoundaryData({
			type: "Topology",
			transform: { scale: [1, 1], translate: [0, 0] },
			arcs: [
				[
					[0, 0],
					[1, 0],
					[0, 1],
					[-1, 0],
					[0, -1],
				],
			],
			objects: {
				area: {
					type: "GeometryCollection",
					geometries: [
						{ type: "Polygon", arcs: [[0]] },
						{ type: "Polygon", arcs: [[0]] },
					],
				},
			},
		});

		expect(boundary.features).toHaveLength(2);
	});

	it("passes a plain FeatureCollection through, adding the CRS", () => {
		const boundary = decodeBoundaryData({
			type: "FeatureCollection",
			features: [],
		});

		expect(boundary.type).toBe("FeatureCollection");
		expect(boundary.crs.properties.name).toBe(
			"urn:ogc:def:crs:OGC:1.3:CRS84",
		);
	});

	it("reprojects British National Grid GeoJSON to the map's longitude/latitude CRS", () => {
		const boundary = decodeBoundaryData({
			type: "FeatureCollection",
			crs: { type: "name", properties: { name: "EPSG:27700" } },
			features: [
				{
					type: "Feature",
					properties: {},
					geometry: { type: "Point", coordinates: [543620, 184826] },
				},
			],
		});

		expect(boundary.crs.properties.name).toBe(
			"urn:ogc:def:crs:OGC:1.3:CRS84",
		);
		const [longitude, latitude] = boundary.features[0].geometry.coordinates;
		expect(longitude).toBeCloseTo(0.1, 1);
		expect(latitude).toBeCloseTo(51.5, 1);
	});

	it("refuses a TopoJSON file with no geometry objects", () => {
		expect(() =>
			decodeBoundaryData({
				type: "Topology",
				arcs: [],
				objects: {},
			}),
		).toThrow("TopoJSON contains no geometry objects");
	});
});
