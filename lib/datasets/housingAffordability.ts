import { loadHousingAffordability } from "@/lib/data/housing-affordability/loader";
import type { HousingAffordabilityDataset } from "@/lib/types/housingAffordability";
import type { ScalarDatasetDefinition } from "./types";

export const housingAffordabilityDefinition: ScalarDatasetDefinition<HousingAffordabilityDataset> = {
	type: "housingAffordability",
	precompiledFile: "housing-affordability",
	sourcePath: "economics/housing-affordability/housing-affordability-2025.csv",
	sourceFormat: "text",
	chart: {
		group: "Economics",
		key: "economics-housingAffordability",
		label: "Housing Affordability [2025]",
		defaultVisible: true,
	},
	load: loadHousingAffordability,
};
