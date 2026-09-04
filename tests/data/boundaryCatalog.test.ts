import { describe, expect, it } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/boundaries";
import {
	BOUNDARY_TYPES,
	boundaryTypeForCodeKey,
	boundaryYears,
	nameKeyForCodeKey,
} from "@/lib/data/boundaries/catalog";

describe("boundary catalogue", () => {
	it("describes every downloadable boundary vintage", () => {
		for (const definition of Object.values(BOUNDARY_CATALOG)) {
			expect(definition.properties.code.length).toBeGreaterThan(0);
			expect(definition.properties.name.length).toBeGreaterThan(0);
			for (const path of Object.values(definition.vintages)) {
				expect(path).toMatch(
					/^\/data\/boundaries\/.+\.(topojson|geojson)/,
				);
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

describe("catalogue lookups", () => {
	it("lists every geography in declaration order", () => {
		expect(BOUNDARY_TYPES).toEqual(Object.keys(BOUNDARY_CATALOG));
	});

	it("reports a geography's vintages newest first", () => {
		const years = boundaryYears("ward");
		expect(years).toEqual([...years].sort((a, b) => b - a));
		expect(years).toEqual(
			Object.keys(BOUNDARY_CATALOG.ward.vintages)
				.map(Number)
				.sort((a, b) => b - a),
		);
	});

	it("resolves every catalogued code key back to its geography", () => {
		for (const [type, family] of Object.entries(BOUNDARY_CATALOG)) {
			for (const codeKey of family.properties.code) {
				expect(boundaryTypeForCodeKey(codeKey)).toBe(type);
			}
		}
	});

	it("pairs each code key with the name key beside it", () => {
		expect(nameKeyForCodeKey("WD24CD")).toBe("WD24NM");
		expect(nameKeyForCodeKey("DataZone")).toBe("Name");
		expect(nameKeyForCodeKey("SOA_CODE")).toBe("SOA_LABEL");
		expect(nameKeyForCodeKey("SOA2011")).toBe("SOA2011 Name");
	});

	it("reports nothing for a key the catalogue does not list", () => {
		expect(boundaryTypeForCodeKey("NOT_A_CODE")).toBeUndefined();
		expect(nameKeyForCodeKey("NOT_A_CODE")).toBeUndefined();
	});
});
