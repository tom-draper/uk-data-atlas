import { describe, expect, it } from "vitest";
import { ATLAS_BOUNDARY_VINTAGES } from "@uk-data-atlas/catalogue";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";

/** A served asset's release id: `boundaries/ward/2024-12-uk-bgc/...`. */
const releaseOf = (asset: string) => asset.split("/").at(-2)!;

describe("the boundary releases the API compiles the atlas's lookups for", () => {
	it.each(Object.keys(ATLAS_BOUNDARY_VINTAGES))(
		"are the %s releases the atlas draws",
		(geography) => {
			const drawn = Object.fromEntries(
				Object.entries(
					BOUNDARY_CATALOG[
						geography as keyof typeof ATLAS_BOUNDARY_VINTAGES
					].vintages,
				).map(([year, asset]) => [year, releaseOf(asset)]),
			);
			expect(
				ATLAS_BOUNDARY_VINTAGES[
					geography as keyof typeof ATLAS_BOUNDARY_VINTAGES
				],
			).toEqual(drawn);
		},
	);
});
