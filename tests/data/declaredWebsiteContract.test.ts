import { describe, expect, it } from "vitest";
import { ATLAS_MAPS } from "@/lib/atlas/pages";
import { formatRankedValue } from "@/lib/atlas/rankings";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import { DATASET_DECLARATIONS, typeOf } from "@uk-data-atlas/datasets";
import {
	CATEGORY_CHART_DEFINITIONS,
	CATEGORY_DATASET_TYPES,
} from "@/lib/datasets/categories";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { getChartPresentation } from "@/lib/datasets/generatedCharts";

const HAND_WRITTEN = new Set([
	"brexit",
	"brexit-constituency",
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

describe("a dataset declaring categories needs no website code of its own", () => {
	const declared = DATASET_DECLARATIONS.filter(
		({ categories }) => categories !== undefined,
	).map(({ id }) => id);

	it("lists every one in the map options types, so they type-check", () => {
		expect([...CATEGORY_DATASET_TYPES]).toEqual(declared);
	});

	it("gives each one map options, a registered chart card and a category legend", () => {
		for (const definition of CATEGORY_CHART_DEFINITIONS) {
			expect(
				DEFAULT_MAP_OPTIONS[
					definition.type as keyof typeof DEFAULT_MAP_OPTIONS
				],
				definition.type,
			).toBeDefined();
			expect(definition.legendKind, definition.type).toBe("category");
			expect(
				getChartPresentation(definition.chart.key),
				definition.type,
			).toBeDefined();
			expect(
				CHART_DATASET_DEFINITIONS.some(
					({ type }) => type === definition.type,
				),
				definition.type,
			).toBe(true);
		}
	});
});
