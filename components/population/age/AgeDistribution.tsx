// components/population/age/AgeDistribution.tsx
import { useMemo } from "react";
import { AggregatedPopulationData, PopulationDataset, AgeGroups } from "@/lib/types";
import AgeDistributionChart from "./AgeDistributionChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface AgeDistributionProps {
	dataset: PopulationDataset;
	aggregatedData: AggregatedPopulationData | null;
	wardCode: string;
	activeDatasetId: string;
	setActiveDatasetId: (datasetId: string) => void;
	codeMapper: CodeMapper;
}

export default function AgeDistribution({
	dataset,
	aggregatedData,
	wardCode,
	setActiveDatasetId,
	activeDatasetId,
	codeMapper,
}: AgeDistributionProps) {
	const isActive = activeDatasetId === "population";
	const colors = {
		bg: "bg-emerald-50/60",
		border: "border-emerald-300",
		badge: "bg-emerald-300 text-emerald-900",
		text: "bg-emerald-200 text-emerald-800",
	};

	const { medianAge, ageGroups, total, ages } = useMemo(() => {
		const getAgeGroupKey = (age: number): keyof AgeGroups => {
			if (age <= 17) return "0-17";
			if (age <= 29) return "18-29";
			if (age <= 44) return "30-44";
			if (age <= 64) return "45-64";
			return "65+";
		};

		const ageGroups = {
			"0-17": 0, "18-29": 0, "30-44": 0, "45-64": 0, "65+": 0
		};

		if (wardCode && dataset) {
			const codesToTry = [
				wardCode,
				codeMapper.convertWardCode(wardCode, 2021),
			].filter((code): code is string => code !== null);

			for (const code of codesToTry) {
				const wardData = dataset.populationData[code];
				if (!wardData) continue;

				const agesCountTotal = wardData.total;

				// Build ages array 0-99
				const agesArray = Array.from({ length: 100 }, (_, i) => ({
					age: i,
					count: agesCountTotal[i.toString()] || 0
				}));

				// Apply 90+ smoothing (same as aggregated method)
				const age90Plus = agesArray[90].count;
				const decayRate = 0.15;
				const weights = Array.from({ length: 10 }, (_, i) => Math.exp(-decayRate * i));
				const totalWeight = weights.reduce((sum, w) => sum + w, 0);
				for (let i = 90; i < 100; i++) {
					const weight = weights[i - 90];
					agesArray[i] = { age: i, count: (age90Plus * weight) / totalWeight };
				}

				const totalPopulation = agesArray.reduce((sum, { count }) => sum + count, 0);

				// Compute median age
				let cumulative = 0;
				let median = 0;
				for (const { age, count } of agesArray) {
					cumulative += count;
					if (cumulative >= totalPopulation / 2) {
						median = age;
						break;
					}
				}

				// Fill grouped buckets
				for (const { age, count } of agesArray) {
					const key = getAgeGroupKey(age);
					ageGroups[key] += count;
				}

				return {
					medianAge: median,
					ageGroups: ageGroups,
					total: totalPopulation,
					ages: agesArray,
				};
			}
		} else if (aggregatedData) {
			return {
				medianAge: aggregatedData[2020].medianAge ?? 0,
				ageGroups: aggregatedData[2020].populationStats.ageGroups.total ?? ageGroups,
				total: aggregatedData[2020].populationStats.total ?? 0,
				ages: aggregatedData[2020].ages ?? [],
			};
		}

		return { medianAge: 0, ageGroups: ageGroups, total: 0, ages: [] };
	}, [wardCode, dataset, aggregatedData, codeMapper]);

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${isActive
					? `${colors.bg} border-2 ${colors.border}`
					: `bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300`
				}`}
			onClick={() => setActiveDatasetId("population")}
		>
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-xs font-bold">Age Distribution (2020)</h3>
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