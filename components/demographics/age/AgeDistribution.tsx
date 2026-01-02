// components/population/age/AgeDistribution.tsx
import { memo, useMemo } from "react";
import {
	ActiveViz,
	AgeGroups,
	AggregatedPopulationData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";
import AgeDistributionChart from "./AgeDistributionChart";

interface AgeDistributionProps {
	dataset: PopulationDataset;
	aggregatedData: Record<number, AggregatedPopulationData> | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: {
		getCodeForYear: (
			type: "ward",
			code: string,
			targetYear: number,
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
}

// Pre-calculate age group boundaries (constant)
const AGE_BOUNDARIES = [
	{ max: 17, key: "0-17" as keyof AgeGroups },
	{ max: 29, key: "18-29" as keyof AgeGroups },
	{ max: 44, key: "30-44" as keyof AgeGroups },
	{ max: 64, key: "45-64" as keyof AgeGroups },
	{ max: Infinity, key: "65+" as keyof AgeGroups },
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
const NORMALIZED_WEIGHTS = DECAY_WEIGHTS.map((w) => w / totalWeight);

// Cache for LAD aggregations
const ageDistributionCache = new Map<string, Map<number, any>>();

function AgeDistribution({
	dataset,
	aggregatedData,
	selectedArea,
	activeViz,
	setActiveViz,
	codeMapper,
}: AgeDistributionProps) {
	const vizId = `ageDistribution${dataset.year}`;
	const isActive = activeViz.vizId === vizId;

	const { medianAge, ageGroups, total, counts, maxCount } = useMemo(() => {
		const emptyAgeGroups: AgeGroups = {
			"0-17": 0,
			"18-29": 0,
			"30-44": 0,
			"45-64": 0,
			"65+": 0,
		};
		let max = 0;

		//  Handle Aggregated Data Case (no area selected)
		if (selectedArea === null && aggregatedData) {
			const data = aggregatedData[dataset.year];
			const counts = new Uint32Array(100);

			if (data.ages) {
				for (let i = 0; i < data.ages.length; i++) {
					const item = data.ages[i];
					if (item.age < 100) {
						counts[item.age] = item.count;
						if (item.count > max) max = item.count;
					}
				}
			}

			return {
				medianAge: data.medianAge ?? 0,
				ageGroups:
					data.populationStats.ageGroups.total ?? emptyAgeGroups,
				total: data.populationStats.total ?? 0,
				counts: counts,
				maxCount: max,
			};
		}

		// Handle Ward Selection
		if (selectedArea && selectedArea.type === "ward") {
			const wardCode = selectedArea.code;
			let wardData = dataset.data[wardCode];

			// Try to map ward code if not found
			if (!wardData && codeMapper?.getCodeForYear) {
				const mappedCode = codeMapper.getCodeForYear(
					"ward",
					wardCode,
					dataset.boundaryYear,
				);
				if (mappedCode) {
					wardData = dataset.data[mappedCode];
				}
			}

			if (!wardData) {
				return {
					medianAge: 0,
					ageGroups: emptyAgeGroups,
					total: 0,
					counts: new Uint32Array(100),
					maxCount: 0,
				};
			}

			const agesCountTotal = wardData.total;

			// OPTIMIZATION: Use Typed Array for speed
			const counts = new Uint32Array(100);
			let totalPopulation = 0;
			let max = 0;

			// Build ages 0-89
			for (let i = 0; i < 90; i++) {
				const count = agesCountTotal[i.toString()] || 0;
				counts[i] = count;
				totalPopulation += count;
				if (count > max) max = count;
			}

			// Apply 90+ smoothing
			const age90Plus = agesCountTotal["90"] || 0;
			for (let i = 90; i < 100; i++) {
				const count = Math.round(
					age90Plus * NORMALIZED_WEIGHTS[i - 90],
				);
				counts[i] = count;
				totalPopulation += count;
				if (count > max) max = count;
			}

			// Compute median age
			let cumulative = 0;
			const halfPopulation = totalPopulation / 2;
			let median = 0;

			// Fill grouped buckets
			const currentAgeGroups: AgeGroups = { ...emptyAgeGroups };

			let medianFound = false;
			for (let i = 0; i < 100; i++) {
				const count = counts[i];

				// Grouping logic
				const key = getAgeGroupKey(i);
				currentAgeGroups[key] += count;

				// Median logic (integrated into single loop)
				if (!medianFound) {
					cumulative += count;
					if (cumulative >= halfPopulation) {
						median = i;
						medianFound = true;
					}
				}
			}

			return {
				medianAge: median,
				ageGroups: currentAgeGroups,
				total: totalPopulation,
				counts: counts,
				maxCount: max,
			};
		}

		// Handle Local Authority Selection
		if (
			selectedArea &&
			selectedArea.type === "localAuthority" &&
			codeMapper?.getWardsForLad
		) {
			const ladCode = selectedArea.code;
			const cacheKey = `lad-${ladCode}`;

			if (!ageDistributionCache.has(cacheKey)) {
				ageDistributionCache.set(cacheKey, new Map());
			}
			const yearCache = ageDistributionCache.get(cacheKey)!;

			if (yearCache.has(dataset.year)) {
				return yearCache.get(dataset.year);
			}

			// Get all wards in this LAD
			const wardCodes = codeMapper.getWardsForLad(ladCode, 2024);

			if (wardCodes.length === 0) {
				const emptyResult = {
					medianAge: 0,
					ageGroups: emptyAgeGroups,
					total: 0,
					counts: new Uint32Array(100),
					maxCount: 0,
				};
				yearCache.set(dataset.year, emptyResult);
				return emptyResult;
			}

			// Aggregate age counts across all wards
			const aggregatedCounts = new Uint32Array(100);

			for (const wardCode of wardCodes) {
				let wardData = dataset.data?.[wardCode];

				// Try to map to the dataset's year if ward code doesn't exist
				if (!wardData && codeMapper?.getCodeForYear) {
					const mappedCode = codeMapper.getCodeForYear(
						"ward",
						wardCode,
						dataset.boundaryYear,
					);
					if (mappedCode) {
						wardData = dataset.data[mappedCode];
					}
				}

				if (wardData?.total) {
					// Add ages 0-89
					for (let i = 0; i < 90; i++) {
						const count = wardData.total[i.toString()] || 0;
						aggregatedCounts[i] += count;
					}

					// Apply 90+ smoothing for this ward and add to aggregate
					const age90Plus = wardData.total["90"] || 0;
					for (let i = 90; i < 100; i++) {
						const count = Math.round(
							age90Plus * NORMALIZED_WEIGHTS[i - 90],
						);
						aggregatedCounts[i] += count;
					}
				}
			}

			// Calculate statistics from aggregated counts
			let totalPopulation = 0;
			let max = 0;

			for (let i = 0; i < 100; i++) {
				totalPopulation += aggregatedCounts[i];
				if (aggregatedCounts[i] > max) max = aggregatedCounts[i];
			}

			// Compute median age
			let cumulative = 0;
			const halfPopulation = totalPopulation / 2;
			let median = 0;
			let medianFound = false;

			// Fill grouped buckets
			const currentAgeGroups: AgeGroups = { ...emptyAgeGroups };

			for (let i = 0; i < 100; i++) {
				const count = aggregatedCounts[i];

				// Grouping logic
				const key = getAgeGroupKey(i);
				currentAgeGroups[key] += count;

				// Median logic
				if (!medianFound) {
					cumulative += count;
					if (cumulative >= halfPopulation) {
						median = i;
						medianFound = true;
					}
				}
			}

			const result = {
				medianAge: median,
				ageGroups: currentAgeGroups,
				total: totalPopulation,
				counts: aggregatedCounts,
				maxCount: max,
			};

			// Cache the result
			yearCache.set(dataset.year, result);
			return result;
		}

		// Handle Missing Data or unsupported area types
		return {
			medianAge: 0,
			ageGroups: emptyAgeGroups,
			total: 0,
			counts: new Uint32Array(100),
			maxCount: 0,
		};
	}, [dataset, aggregatedData, selectedArea, codeMapper]);

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${isActive
					? "bg-cyan-50/60 border-2 border-cyan-300"
					: "bg-white/60 border-2 border-gray-200/80 hover:border-cyan-300"
				}`}
			onClick={() =>
				setActiveViz({
					vizId: vizId,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-xs font-bold">
					Age Distribution [{dataset.year}]
				</h3>
				{medianAge > 0 && (
					<span className="text-[10px] text-gray-500 mr-1">
						Median: {medianAge}
					</span>
				)}
			</div>

			{/* Pass primitive props to ensure reference stability and speed */}
			<AgeDistributionChart
				counts={counts}
				maxCount={maxCount}
				total={total}
				ageGroups={ageGroups}
				isActive={isActive}
			/>
		</div>
	);
}

export default memo(AgeDistribution);
