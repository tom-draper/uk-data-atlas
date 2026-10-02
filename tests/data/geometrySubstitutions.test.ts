import { describe, expect, it } from "vitest";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import {
	GEOMETRY_SUBSTITUTIONS,
	KNOWN_GEOMETRY_DISPLACEMENTS,
	REVERSED_GRID_OFFSETS,
} from "@uk-data-atlas/geography";

describe("geometry substitution definitions", () => {
	const served = (geography: string, release: string) =>
		BOUNDARY_CATALOG[
			geography as keyof typeof BOUNDARY_CATALOG
		]?.releases.some(({ id }) => id === release) ?? false;

	it("name releases the catalogue serves", () => {
		for (const { geography, releases, donor } of GEOMETRY_SUBSTITUTIONS) {
			for (const release of releases)
				expect(served(geography, release), release).toBe(true);
			expect(served(donor.geography, donor.boundaryRelease)).toBe(true);
			expect(releases).not.toContain(donor.boundaryRelease);
		}
		for (const { geography, boundaryRelease } of [
			...KNOWN_GEOMETRY_DISPLACEMENTS,
			...REVERSED_GRID_OFFSETS,
		])
			expect(served(geography, boundaryRelease), boundaryRelease).toBe(
				true,
			);
	});
});
