import { describe, expect, it } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/boundaries";

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

	it("keeps each boundary family's paths and property keys together", () => {
		for (const definition of Object.values(BOUNDARY_CATALOG)) {
			expect(definition.properties.code).not.toBe(
				definition.properties.name,
			);
			expect(Object.keys(definition.vintages)).not.toHaveLength(0);
		}
	});
});
