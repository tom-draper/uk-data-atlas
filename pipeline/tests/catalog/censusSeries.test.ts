import { expect, test } from "vitest";
import { readMeasureDimensionsMapping } from "@uk-data-atlas/measures";
import { CENSUS_BREAKDOWNS } from "../../src/catalog/census.ts";
import { fileURLToPath } from "node:url";

test("census authority fields declare the same series as the catalogue", () => {
	const identities = readMeasureDimensionsMapping(
		fileURLToPath(new URL("../../..", import.meta.url)),
	).ids;
	for (const breakdown of CENSUS_BREAKDOWNS) {
		const categories = breakdown.categories as readonly (readonly [
			string,
			string,
			string,
			string?,
		])[];
		for (const [suffix, , , member] of categories)
			expect(identities[`${breakdown.datasetId}-${suffix}`]).toEqual({
				measure: breakdown.measure,
				dimensions: { [breakdown.dimension]: member ?? suffix },
			});
	}
});
