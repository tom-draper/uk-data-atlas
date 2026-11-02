import { it, expect } from "vitest";
import { ghgEmissionsDefinition } from "@/lib/datasets/ghgEmissions";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { aggregateGhgEmissions } from "@/lib/helpers/datasetAggregation/numeric";
import type { GhgEmissionsDataset } from "@uk-data-atlas/datasets/types/ghgEmissions";
const record = {
	ladCode: "E1",
	ladName: "Area",
	totalKtCO2e: 100,
	excludingLandUseKtCO2e: 150,
	perPersonTCO2e: 5,
	populationThousands: 20,
	transport: 10,
	domestic: 20,
	industry: 30,
	commercial: 40,
	publicSector: 5,
	agriculture: 15,
	waste: 30,
	landUse: -50,
};
it("maps all sectors including negative land use and sums regional sectors", () => {
	const dataset = { data: { E1: record } } as unknown as GhgEmissionsDataset;
	for (const measure of [
		"transport",
		"domestic",
		"industry",
		"commercial",
		"publicSector",
		"agriculture",
		"waste",
		"landUse",
	] as const) {
		const options = {
			...DEFAULT_MAP_OPTIONS,
			ghgEmissions: { ...DEFAULT_MAP_OPTIONS.ghgEmissions, measure },
		};
		expect(
			ghgEmissionsDefinition.map?.valueFor?.(dataset, "E1", options),
		).toBe(record[measure]);
		expect(
			ghgEmissionsDefinition.map?.valueFor?.(dataset, "missing", options),
		).toBeNull();
		expect(aggregateGhgEmissions([record, record])?.[measure]).toBe(
			record[measure] * 2,
		);
	}
});
