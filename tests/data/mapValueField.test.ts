import { describe, expect, it } from "vitest";
import { CATALOGUE_DATASET_DEFINITIONS } from "@uk-data-atlas/datasets";
import { getChartDatasetDefinition } from "@/lib/datasets";

const declared = CATALOGUE_DATASET_DEFINITIONS.filter(
	(definition) => definition.mapValueField !== undefined,
);

describe("mapValueField", () => {
	it("is declared by some datasets", () => {
		expect(declared.length).toBeGreaterThan(0);
	});

	it.each(declared.map((definition) => [definition.type, definition]))(
		"%s names the field its map reads",
		(_type, definition) => {
			const chart = getChartDatasetDefinition(definition.type);
			expect(chart?.map?.valueKey).toBe(definition.mapValueField);
		},
	);

	it.each(declared.map((definition) => [definition.type, definition]))(
		"%s has a map that reads one plain field",
		(_type, definition) => {
			const chart = getChartDatasetDefinition(definition.type);
			// A derived value, an option-dependent source or a custom renderer
			// would not be the field's value, so the array would colour wrongly.
			expect(chart?.mapRenderer).toBeUndefined();
			expect(chart?.map?.valueFor).toBeUndefined();
			expect(chart?.map?.sourceMode).toBeUndefined();
		},
	);
});
