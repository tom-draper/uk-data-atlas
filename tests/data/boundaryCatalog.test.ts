import { describe, expect, it } from "vitest";
import {
	BOUNDARY_CATALOG,
	GEOJSON_PATHS,
	PROPERTY_KEYS,
} from "@/lib/data/boundaries/boundaries";

describe("boundary catalogue", () => {
	it("describes every downloadable boundary vintage", () => {
		for (const definition of Object.values(BOUNDARY_CATALOG)) {
			expect(definition.properties.code.length).toBeGreaterThan(0);
			expect(definition.properties.name.length).toBeGreaterThan(0);
			for (const path of Object.values(definition.vintages)) {
				expect(path).toMatch(/^\/data\/boundaries\/.+\.topojson/);
			}
		}
	});

	it("derives legacy paths and property-key exports from the catalogue", () => {
		expect(GEOJSON_PATHS.ward).toBe(BOUNDARY_CATALOG.ward.vintages);
		expect(GEOJSON_PATHS.localAuthority).toBe(
			BOUNDARY_CATALOG.localAuthority.vintages,
		);
		expect(PROPERTY_KEYS.wardCode).toBe(
			BOUNDARY_CATALOG.ward.properties.code,
		);
		expect(PROPERTY_KEYS.ladName).toBe(
			BOUNDARY_CATALOG.localAuthority.properties.name,
		);
	});
});
