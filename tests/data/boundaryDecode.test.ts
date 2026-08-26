import { describe, expect, it } from "vitest";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";

describe("decodeBoundaryData", () => {
	it("converts TopoJSON and adds the CRS expected by map layers", () => {
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
});
