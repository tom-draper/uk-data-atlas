// components/population/gender/GenderBalanceByAgeChart.tsx
import { useMemo, memo } from "react";
import {
	AggregatedPopulationData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";

export interface GenderBalanceByAgeChartProps {
	dataset: PopulationDataset;
	aggregatedData: AggregatedPopulationData | null;
	selectedArea: SelectedArea | null;
	codeMapper?: {
		getCodeForYear: (
			type: "ward" | "localAuthority",
			code: string,
			targetYear: number
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
}

// Pre-create age indices array (constant)
const AGE_INDICES = Array.from({ length: 91 }, (_, i) => i);

// Cache for LAD gender balance aggregations
const genderBalanceCache = new Map<string, Map<number, any>>();

function GenderBalanceByAgeChart({
	dataset,
	aggregatedData,
	selectedArea,
	codeMapper,
}: GenderBalanceByAgeChartProps) {
	// Memoize both data AND percentages to avoid recalculation on every render
	const { ageData, percentages } = useMemo(() => {
		// Handle no area selected - use aggregated data
		if (selectedArea === null && aggregatedData) {
			const data =
				aggregatedData[dataset.year].medianAge !== 0
					? aggregatedData[dataset.year].genderAgeData
					: [];

			// Pre-calculate percentages
			const pct = data.map(({ males, females }) => {
				const total = males + females;
				return total > 0 ? (males / total) * 100 : 50;
			});

			return { ageData: data, percentages: pct };
		}

		// Handle Ward Selection
		if (selectedArea && selectedArea.type === "ward") {
			const wardCode = selectedArea.code;
			let wardData = dataset.data[wardCode];

			// Try to map ward code if not found
			if (!wardData && codeMapper?.getCodeForYear) {
				const mappedCode = codeMapper.getCodeForYear('ward', wardCode, dataset.boundaryYear);
				if (mappedCode) {
					wardData = dataset.data[mappedCode];
				}
			}

			if (wardData) {
				const { males, females } = wardData;
				const data: Array<{ age: number; males: number; females: number }> =
					new Array(91);
				const pct: number[] = new Array(91);

				// Single loop: build data AND calculate percentages
				for (let age = 0; age < 91; age++) {
					const ageStr = age.toString();
					const m = males[ageStr] || 0;
					const f = females[ageStr] || 0;
					const total = m + f;

					data[age] = { age, males: m, females: f };
					pct[age] = total > 0 ? (m / total) * 100 : 50;
				}

				return { ageData: data, percentages: pct };
			}

			return { ageData: [], percentages: [] };
		}

		// Handle Local Authority Selection
		if (selectedArea && selectedArea.type === 'localAuthority' && codeMapper?.getWardsForLad) {
			const ladCode = selectedArea.code;
			const cacheKey = `lad-${ladCode}`;
			
			if (!genderBalanceCache.has(cacheKey)) {
				genderBalanceCache.set(cacheKey, new Map());
			}
			const yearCache = genderBalanceCache.get(cacheKey)!;

			if (yearCache.has(dataset.year)) {
				return yearCache.get(dataset.year);
			}

			// Get all wards in this LAD
			const wardCodes = codeMapper.getWardsForLad(ladCode, 2022);
			
			if (wardCodes.length === 0) {
				const emptyResult = { ageData: [], percentages: [] };
				yearCache.set(dataset.year, emptyResult);
				return emptyResult;
			}

			// Aggregate gender counts by age across all wards
			const aggregatedMales = new Array(91).fill(0);
			const aggregatedFemales = new Array(91).fill(0);

			for (const wardCode of wardCodes) {
				let wardData = dataset.data?.[wardCode];
				
				// Try to map to the dataset's year if ward code doesn't exist
				if (!wardData && codeMapper?.getCodeForYear) {
					const mappedCode = codeMapper.getCodeForYear('ward', wardCode, dataset.boundaryYear);
					if (mappedCode) {
						wardData = dataset.data[mappedCode];
					}
				}
				
				if (wardData) {
					// Sum males and females by age
					for (let age = 0; age < 91; age++) {
						const ageStr = age.toString();
						aggregatedMales[age] += wardData.males[ageStr] || 0;
						aggregatedFemales[age] += wardData.females[ageStr] || 0;
					}
				}
			}

			// Build data array and calculate percentages
			const data: Array<{ age: number; males: number; females: number }> = new Array(91);
			const pct: number[] = new Array(91);

			for (let age = 0; age < 91; age++) {
				const m = aggregatedMales[age];
				const f = aggregatedFemales[age];
				const total = m + f;

				data[age] = { age, males: m, females: f };
				pct[age] = total > 0 ? (m / total) * 100 : 50;
			}

			const result = { ageData: data, percentages: pct };

			// Cache the result
			yearCache.set(dataset.year, result);
			return result;
		}

		// Unsupported area type or missing data
		return { ageData: [], percentages: [] };

	}, [dataset, aggregatedData, selectedArea, codeMapper]);

	if (ageData.length === 0) {
		return (
			<div className="text-xs h-27.75 text-gray-400/80 text-center grid place-items-center">
				<div className="mb-4">No data available</div>
			</div>
		);
	}

	return (
		<div className="px-0.5 pt-0 -my-1">
			{/* Age labels */}
			<div className="flex justify-center text-[8px] text-gray-500 mt-0 mx-auto">
				<span>0</span>
			</div>

			<div className="relative rounded overflow-hidden">
				{/* Center line - using transform for GPU */}
				<div
					className="absolute top-0 bottom-0 w-px bg-gray-300 z-10 translate-x-1/2 left-1/2"
					style={{ marginLeft: "-1px" }}
				/>

				{/* Stack of age rows - Minimal DOM, maximum performance */}
				<div className="relative will-change-contents">
					{AGE_INDICES.map((age) => {
						const data = ageData[age];
						if (!data) return null;

						const { males, females } = data;
						const total = males + females;

						if (total === 0) {
							return <div key={age} className="h-px" />;
						}

						const malePercentage = percentages[age];
						const femalePercentage = 100 - malePercentage;

						// Use inline styles for dynamic values (faster than recalculating classes)
						return (
							<div
								key={age}
								className="flex h-px group relative"
								title={`Age ${age}: ${males.toLocaleString()}M / ${females.toLocaleString()}F`}
							>
								{/* Males (left) - minimal inline styles */}
								<div
									className="bg-blue-400"
									style={{ width: `${malePercentage}%` }}
								/>

								{/* Females (right) */}
								<div
									className="bg-pink-400"
									style={{ width: `${femalePercentage}%` }}
								/>

								{/* Tooltip - only visible on hover, uses transform for GPU */}
								<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 bg-gray-800 text-white text-[8px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20 transition-opacity">
									Age {age}: {males.toLocaleString()}M /{" "}
									{females.toLocaleString()}F ({malePercentage.toFixed(1)}%
									male)
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Age labels */}
			<div className="flex justify-center text-[8px] text-gray-500 mt-1 -mb-1">
				<span>90</span>
			</div>
		</div>
	);
}

export default memo(GenderBalanceByAgeChart);