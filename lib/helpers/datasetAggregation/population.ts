import type {
	AgeGroups,
	Features,
	PopulationDataset,
	PopulationStats,
	PropertyKeys,
} from "@lib/types";
import { getFeatureProp } from "@lib/types";
import { calculateTotal, polygonAreaSqKm } from "../population";
import { calculateAgeGroups } from "../ageDistribution";

// Pre-computed decay weights for age 90+ distribution
const AGE_90_WEIGHTS = (() => {
	const decayRate = 0.15;
	const weights = Array.from({ length: 10 }, (_, i) =>
		Math.exp(-decayRate * i),
	);
	const totalWeight = weights.reduce((sum, w) => sum + w, 0);
	return weights.map((w) => w / totalWeight);
})();

const emptyAgeGroups = (): AgeGroups => ({
	"0-17": 0,
	"18-29": 0,
	"30-44": 0,
	"45-64": 0,
	"65+": 0,
});

/** Running totals accumulated across the boundaries covered by a selection. */
export interface PopulationTotals {
	totalPop: number;
	malesPop: number;
	femalesPop: number;
	totalArea: number;
	ageGroups: { total: AgeGroups; males: AgeGroups; females: AgeGroups };
	ageData: Record<string, number>;
	males: Record<string, number>;
	females: Record<string, number>;
}

/** Sums population counts and land area over the boundaries with ward data. */
export function accumulatePopulation(
	features: Features,
	codeProperty: PropertyKeys,
	data: PopulationDataset["data"],
): PopulationTotals {
	// Pre-allocate objects
	const ageData: Record<string, number> = {};
	const males: Record<string, number> = {};
	const females: Record<string, number> = {};

	const aggregated: PopulationTotals = {
		totalPop: 0,
		malesPop: 0,
		femalesPop: 0,
		totalArea: 0,
		ageGroups: {
			total: emptyAgeGroups(),
			males: emptyAgeGroups(),
			females: emptyAgeGroups(),
		},
		ageData,
		males,
		females,
	};

	for (let i = 0; i < features.length; i++) {
		const ward =
			data[getFeatureProp(features[i].properties, codeProperty) ?? ""];
		if (!ward) continue;

		aggregated.totalPop += calculateTotal(ward.total);
		aggregated.malesPop += calculateTotal(ward.males);
		aggregated.femalesPop += calculateTotal(ward.females);

		const wardAgeGroups = {
			total: calculateAgeGroups(ward.total),
			males: calculateAgeGroups(ward.males),
			females: calculateAgeGroups(ward.females),
		};

		// Direct key access faster than loop
		aggregated.ageGroups.total["0-17"] += wardAgeGroups.total["0-17"];
		aggregated.ageGroups.total["18-29"] += wardAgeGroups.total["18-29"];
		aggregated.ageGroups.total["30-44"] += wardAgeGroups.total["30-44"];
		aggregated.ageGroups.total["45-64"] += wardAgeGroups.total["45-64"];
		aggregated.ageGroups.total["65+"] += wardAgeGroups.total["65+"];

		aggregated.ageGroups.males["0-17"] += wardAgeGroups.males["0-17"];
		aggregated.ageGroups.males["18-29"] += wardAgeGroups.males["18-29"];
		aggregated.ageGroups.males["30-44"] += wardAgeGroups.males["30-44"];
		aggregated.ageGroups.males["45-64"] += wardAgeGroups.males["45-64"];
		aggregated.ageGroups.males["65+"] += wardAgeGroups.males["65+"];

		aggregated.ageGroups.females["0-17"] += wardAgeGroups.females["0-17"];
		aggregated.ageGroups.females["18-29"] += wardAgeGroups.females["18-29"];
		aggregated.ageGroups.females["30-44"] += wardAgeGroups.females["30-44"];
		aggregated.ageGroups.females["45-64"] += wardAgeGroups.females["45-64"];
		aggregated.ageGroups.females["65+"] += wardAgeGroups.females["65+"];

		// Aggregate age data
		const totalEntries = Object.entries(ward.total);
		for (let j = 0; j < totalEntries.length; j++) {
			const [age, count] = totalEntries[j];
			ageData[age] = (ageData[age] || 0) + count;
		}

		const malesEntries = Object.entries(ward.males);
		for (let j = 0; j < malesEntries.length; j++) {
			const [age, count] = malesEntries[j];
			males[age] = (males[age] || 0) + count;
		}

		const femalesEntries = Object.entries(ward.females);
		for (let j = 0; j < femalesEntries.length; j++) {
			const [age, count] = femalesEntries[j];
			females[age] = (females[age] || 0) + count;
		}

		aggregated.totalArea += polygonAreaSqKm(features[i].geometry);
	}

	return aggregated;
}

/** Derives the single-year age curve, median age and density from the totals. */
export function buildPopulationStats(aggregated: PopulationTotals) {
	const populationStats: PopulationStats = {
		total: aggregated.totalPop,
		males: aggregated.malesPop,
		females: aggregated.femalesPop,
		ageGroups: aggregated.ageGroups,
		isWardSpecific: false,
	};

	// Pre-allocate arrays
	const ages = new Array(100);
	for (let i = 0; i < 100; i++) {
		ages[i] = {
			age: i,
			count: aggregated.ageData[i.toString()] || 0,
		};
	}

	// Distribute 90+ age data using pre-computed weights
	const age90Plus = ages[90].count;
	for (let i = 90; i < 100; i++) {
		ages[i] = {
			age: i,
			count: age90Plus * AGE_90_WEIGHTS[i - 90],
		};
	}

	// Pre-allocate gender age data
	const genderAgeData = new Array(91);
	for (let age = 0; age < 91; age++) {
		genderAgeData[age] = {
			age,
			males: aggregated.males[age.toString()] || 0,
			females: aggregated.females[age.toString()] || 0,
		};
	}

	// Calculate median age
	let medianAge = 0;
	if (aggregated.totalPop > 0) {
		const halfPop = aggregated.totalPop / 2;
		let cumulative = 0;
		for (let i = 0; i < 100; i++) {
			cumulative += ages[i].count;
			if (cumulative >= halfPop) {
				medianAge = ages[i].age;
				break;
			}
		}
	}

	const density =
		aggregated.totalArea > 0
			? aggregated.totalPop / aggregated.totalArea
			: 0;

	return {
		populationStats,
		ageData: aggregated.ageData,
		ages,
		genderAgeData,
		medianAge,
		totalArea: aggregated.totalArea,
		density,
	};
}

/** Aggregates ward population records over the active boundaries. */
export function aggregatePopulation(
	features: Features,
	codeProperty: PropertyKeys,
	data: PopulationDataset["data"],
) {
	return buildPopulationStats(
		accumulatePopulation(features, codeProperty, data),
	);
}
