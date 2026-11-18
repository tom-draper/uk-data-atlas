import { describe, expect, it } from "vitest";
import { ATLAS_MAPS } from "@/lib/atlas/pages";
import { formatRankedValue } from "@/lib/atlas/rankings";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import { DATASET_DECLARATIONS, typeOf } from "@uk-data-atlas/datasets";

const HAND_WRITTEN = new Set([
	"brexit",
	"brexit-constituency",
	"ethnicity",
	"general-election",
	"local-election",
	"population",
]);

describe("a declared dataset needs no website code of its own", () => {
	const declarations = DATASET_DECLARATIONS.filter(
		({ id, display }) => display !== undefined && !HAND_WRITTEN.has(id),
	);

	it("gives each one a chart card drawn by a shared component", () => {
		for (const declaration of declarations) {
			const definition = CHART_DATASET_DEFINITIONS.find(
				({ type }) => type === typeOf(declaration),
			);
			expect(definition, declaration.id).toBeDefined();
			for (const chart of getChartDefinitions(definition!))
				expect(chart.componentPath, declaration.id).toMatch(
					/^@\/components\/(ValueCard|measures\/Measure)/,
				);
		}
	});

	it("puts each one on the map, with a ranking that reads its values", () => {
		for (const declaration of declarations) {
			const maps = ATLAS_MAPS.filter(
				({ dataset }) => dataset === declaration.id,
			);
			expect(maps.length, declaration.id).toBeGreaterThan(0);
			for (const map of maps)
				expect(formatRankedValue(map, 1234.5), map.slug).toMatch(/\d/);
		}
	});
});
