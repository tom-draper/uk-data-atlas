// components/population/age/AgeDistribution.tsx
import { useMemo, memo, useCallback } from "react";
import { AggregatedPopulationData, PopulationDataset, AgeGroups } from "@/lib/types";
import AgeDistributionChart from "./AgeDistributionChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface AgeDistributionProps {
	dataset: PopulationDataset;
	aggregatedData: AggregatedPopulationData | null;
	wardCode?: string;
	constituencyCode?: string;
	activeDatasetId: string;
	setActiveDatasetId: (datasetId: string) => void;
	codeMapper: CodeMapper;
}

// Pre-calculate age group boundaries (constant)
const AGE_BOUNDARIES = [
	{ max: 17, key: "0-17" as keyof AgeGroups },
	{ max: 29, key: "18-29" as keyof AgeGroups },
	{ max: 44, key: "30-44" as keyof AgeGroups },
	{ max: 64, key: "45-64" as keyof AgeGroups },
	{ max: Infinity, key: "65+" as keyof AgeGroups }
];

const getAgeGroupKey = (age: number): keyof AgeGroups => {
	for (let i = 0; i < AGE_BOUNDARIES.length; i++) {
		if (age <= AGE_BOUNDARIES[i].max) {
			return AGE_BOUNDARIES[i].key;
		}
	}
	return "65+";
};

// Pre-calculate decay weights (constant)
const DECAY_RATE = 0.15;
const DECAY_WEIGHTS = new Array(10);
let totalWeight = 0;
for (let i = 0; i < 10; i++) {
	DECAY_WEIGHTS[i] = Math.exp(-DECAY_RATE * i);
	totalWeight += DECAY_WEIGHTS[i];
}
const NORMALIZED_WEIGHTS = DECAY_WEIGHTS.map(w => w / totalWeight);

function AgeDistribution({
	dataset,
	aggregatedData,
	wardCode,
	constituencyCode,
	setActiveDatasetId,
	activeDatasetId,
	codeMapper,
}: AgeDistributionProps) {
 	const datasetId = `population-${dataset.year}`
	const isActive = activeDatasetId === datasetId;

	const { medianAge, ageGroups, total, ages } = useMemo(() => {
		const emptyAgeGroups: AgeGroups = {
			"0-17": 0, "18-29": 0, "30-44": 0, "45-64": 0, "65+": 0
		};

		// Early return for aggregated data case
		if (!wardCode && !constituencyCode && aggregatedData) {
			return {
				medianAge: aggregatedData[dataset.year].medianAge ?? 0,
				ageGroups: aggregatedData[dataset.year].populationStats.ageGroups.total ?? emptyAgeGroups,
				total: aggregatedData[dataset.year].populationStats.total ?? 0,
				ages: aggregatedData[dataset.year].ages ?? [],
			};
		}

		if (!wardCode || !dataset) {
			return { medianAge: 0, ageGroups: emptyAgeGroups, total: 0, ages: [] };
		}

		const codesToTry = [
			wardCode,
			codeMapper.convertWardCode(wardCode, dataset.wardYear),
		].filter((code): code is string => code !== null);

		for (const code of codesToTry) {
			const wardData = dataset.populationData[code];
			if (!wardData) continue;

			const agesCountTotal = wardData.total;

			// Pre-allocate ages array
			const agesArray = new Array(100);
			let totalPopulation = 0;

			// Build ages array 0-89
			for (let i = 0; i < 90; i++) {
				const count = agesCountTotal[i.toString()] || 0;
				agesArray[i] = { age: i, count };
				totalPopulation += count;
			}

			// Apply 90+ smoothing using pre-calculated weights
			const age90Plus = agesCountTotal["90"] || 0;
			for (let i = 90; i < 100; i++) {
				const count = age90Plus * NORMALIZED_WEIGHTS[i - 90];
				agesArray[i] = { age: i, count };
				totalPopulation += count;
			}

			// Compute median age
			let cumulative = 0;
			const halfPopulation = totalPopulation / 2;
			let median = 0;
			for (let i = 0; i < 100; i++) {
				cumulative += agesArray[i].count;
				if (cumulative >= halfPopulation) {
					median = i;
					break;
				}
			}

			// Fill grouped buckets
			const ageGroups: AgeGroups = {
				"0-17": 0, "18-29": 0, "30-44": 0, "45-64": 0, "65+": 0
			};

			for (let i = 0; i < 100; i++) {
				const key = getAgeGroupKey(i);
				ageGroups[key] += agesArray[i].count;
			}

			return {
				medianAge: median,
				ageGroups,
				total: totalPopulation,
				ages: agesArray,
			};
		}

		return { medianAge: 0, ageGroups: emptyAgeGroups, total: 0, ages: [] };
	}, [wardCode, constituencyCode, dataset, aggregatedData, codeMapper]);

	// Memoize the click handler
	const handleClick = useCallback(() => {
		setActiveDatasetId(datasetId);
	}, [setActiveDatasetId]);

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${
				isActive
					? 'bg-emerald-50/60 border-2 border-emerald-300'
					: 'bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300'
			}`}
			onClick={handleClick}
		>
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-xs font-bold">Age Distribution ({dataset.year})</h3>
				{medianAge > 0 && (
					<span className="text-[10px] text-gray-500 mr-1">
						Median: {medianAge}
					</span>
				)}
			</div>
			<AgeDistributionChart
				ages={ages}
				total={total}
				ageGroups={ageGroups}
				isActive={isActive}
			/>
		</div>
	);
}

export default memo(AgeDistribution);