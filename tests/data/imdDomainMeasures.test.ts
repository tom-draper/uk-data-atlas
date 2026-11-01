import { it, expect } from "vitest";
import { summariseIMD } from "@uk-data-atlas/datasets/helpers/datasetAggregation/deprivation";
import type { IMDLSOAData } from "@uk-data-atlas/datasets/types/imd";
it("population weights domain scores and preserves negative scores", () => {
	const a = {
		population: 100,
		imdScore: 10,
		imdDecile: 2,
		incomeScore: 0.1,
		employmentScore: 0.2,
		educationScore: 20,
		healthScore: -1,
		crimeScore: -2,
		housingScore: 30,
		livingEnvironmentScore: 40,
	} as IMDLSOAData;
	const b = { ...a, population: 300, incomeScore: 0.5, healthScore: 1 };
	const stats = summariseIMD([a, b]);
	expect(stats?.domainScores.incomeScore).toBeCloseTo(0.4);
	expect(stats?.domainScores.healthScore).toBe(0.5);
	expect(stats?.domainScores.crimeScore).toBe(-2);
	expect(summariseIMD([])).toBeNull();
});
