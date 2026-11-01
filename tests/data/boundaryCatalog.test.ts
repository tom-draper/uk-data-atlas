import { describe, expect, it } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/boundaries";
import {
	BOUNDARY_TYPES,
	boundaryTypeForCodeKey,
	boundaryYears,
	nameKeyForCodeKey,
} from "@/lib/data/boundaries/catalog";
import {
	BOUNDARY_CAPABILITIES,
	boundaryCapabilityFor,
} from "@uk-data-atlas/datasets/data/boundaries/capabilities";

describe("boundary catalogue", () => {
	it("describes every downloadable boundary vintage", () => {
		for (const definition of Object.values(BOUNDARY_CATALOG)) {
			expect(definition.properties.code.length).toBeGreaterThan(0);
			expect(definition.properties.name.length).toBeGreaterThan(0);
			for (const path of Object.values(definition.vintages)) {
				expect(path).toMatch(/^\/data\/boundaries\/.+\.pmtiles/);
			}
		}
	});

	it("records API imports as held until website tiles are compiled", () => {
		const imported = [
			["lsoa", "2001-12-ew-bgc-v2", "LSOA01CD", "LSOA01NM"],
			["msoa", "2001-12-ew-bgc-v2", "MSOA01CD", "MSOA01NM"],
			["msoa", "2011-12-ew-bgc-v3", "MSOA11CD", "MSOA11NM"],
			["seneddConstituency", "2026-05-w-bgc", "SENC26CD", "SENC26NM"],
		] as const;
		for (const [type, id, codeKey, nameKey] of imported) {
			const release = BOUNDARY_CATALOG[type].releases.find(
				(entry) => entry.id === id,
			);
			expect(release, `${type}/${id}`).toMatchObject({
				id,
				codeKey,
				nameKey,
			});
			expect(release?.asset).toBeUndefined();
			expect(release?.holdReason).toContain("not been compiled");
		}
		expect(boundaryYears("msoa")).toEqual([2021]);
		expect(boundaryYears("seneddConstituency")).toEqual([2022]);
		expect(BOUNDARY_CATALOG.lsoa.vintages[2001]).toContain(
			"/2001-12-ew-bgc/",
		);
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

	it("declares capabilities for every geography", () => {
		expect(Object.keys(BOUNDARY_CAPABILITIES)).toEqual(BOUNDARY_TYPES);
	});

	it("keeps exceptional location and map-data behaviour with its geography", () => {
		expect(
			boundaryCapabilityFor("superOutputArea").countryPrefixFilter,
		).toBe(false);
		for (const type of ["lsoa", "dataZone", "superOutputArea"] as const) {
			expect(
				boundaryCapabilityFor(type).filterGeometryToDatasetData,
			).toBe(true);
		}
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
