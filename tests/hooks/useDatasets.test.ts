import { describe, expect, it } from "vitest";
import { datasetIsNeeded, datasetLoadPriority } from "@/lib/hooks/useDatasets";
import { DEFAULT_VISIBILITY } from "@/lib/context/ChartVisibilityContext";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";

const definitionFor = (type: string) => {
	const definition = CHART_DATASET_DEFINITIONS.find((d) => d.type === type);
	if (!definition) throw new Error(`No dataset definition for ${type}`);
	return definition;
};

/** Datasets whose every card is hidden until the user turns one on. */
const hiddenByDefault = CHART_DATASET_DEFINITIONS.filter(
	(definition) =>
		!getChartDefinitions(definition).some(
			(chart) => DEFAULT_VISIBILITY[chart.key],
		),
);

describe("datasetIsNeeded", () => {
	it("fetches a dataset whose card is shown", () => {
		expect(
			datasetIsNeeded(
				definitionFor("local-election"),
				DEFAULT_VISIBILITY,
			),
		).toBe(true);
	});

	it("skips a dataset with no visible card and nothing on the map", () => {
		for (const definition of hiddenByDefault) {
			expect(datasetIsNeeded(definition, DEFAULT_VISIBILITY)).toBe(false);
		}
	});

	// A link carries the visualisation, not the reader's chart settings, so the
	// dataset the map is drawing has to load whether or not its card is shown.
	// These are the datasets whose cards ship hidden, and so the ones that used
	// to open as an empty map.
	it("fetches the dataset the map is drawing even while its card is hidden", () => {
		expect(hiddenByDefault.map((d) => d.type).sort()).toEqual([
			"adult-social-care-outcomes",
			"brexit-constituency",
			"council-tax",
			"gas-consumption",
			"general-health",
			"housing-tenure",
			"local-government-finance",
			"net-additional-dwellings",
			"nimdm",
			"planning-applications",
			"public-health",
			"pupil-absence",
			"school-performance-disadvantage",
			"simd",
			"unemployment",
			"waste",
			"wimd",
			"workplace-income",
		]);

		for (const definition of hiddenByDefault) {
			expect(
				datasetIsNeeded(
					definition,
					DEFAULT_VISIBILITY,
					definition.type,
				),
			).toBe(true);
		}
	});

	it("does not fetch the rest just because one dataset is active", () => {
		const active = "brexit-constituency";
		for (const definition of hiddenByDefault) {
			if (definition.type === active) continue;
			expect(
				datasetIsNeeded(definition, DEFAULT_VISIBILITY, active),
			).toBe(false);
		}
	});

	it("respects a card the reader has turned on", () => {
		const definition = definitionFor("simd");
		const key = getChartDefinitions(definition)[0]!.key;
		expect(
			datasetIsNeeded(definition, {
				...DEFAULT_VISIBILITY,
				[key]: true,
			}),
		).toBe(true);
	});

	it("prioritises the active map, then visible cards", () => {
		const active = definitionFor("simd");
		const visible = definitionFor("local-election");
		expect(datasetLoadPriority(active, active.type)).toBe(0);
		expect(datasetLoadPriority(visible)).toBe(1);
	});
});
