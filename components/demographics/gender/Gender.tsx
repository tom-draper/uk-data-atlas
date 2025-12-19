// components/population/gender/Gender.tsx
import { useMemo, memo } from "react";
import {
	ActiveViz,
	AggregatedPopulationData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";
import GenderBalanceByAgeChart from "./GenderBalanceByAgeChart";

interface GenderProps {
	dataset: PopulationDataset;
	aggregatedData: AggregatedPopulationData | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: {
		getCodeForYear: (
			type: "ward" | "localAuthority",
			code: string,
			targetYear: number,
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
}

// Cache for LAD gender aggregations
const genderCache = new Map<string, Map<number, any>>();

function Gender({
	dataset,
	aggregatedData,
	selectedArea,
	activeViz,
	setActiveViz,
	codeMapper,
}: GenderProps) {
	const vizId = `gender-${dataset.year}`;
	const isActive = activeViz.vizId === vizId;

	// Calculate total males and females
	const { totalMales, totalFemales } = useMemo(() => {
		// Handle no area selected - use aggregated data
		if (selectedArea === null && aggregatedData) {
			return {
				totalMales: aggregatedData[dataset.year].populationStats.males,
				totalFemales:
					aggregatedData[dataset.year].populationStats.females,
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

			if (wardData) {
				// Use faster iteration than Object.values().reduce()
				let males = 0;
				let females = 0;

				const maleKeys = Object.keys(wardData.males);
				const femaleKeys = Object.keys(wardData.females);

				for (let i = 0; i < maleKeys.length; i++) {
					males += wardData.males[maleKeys[i]];
				}

				for (let i = 0; i < femaleKeys.length; i++) {
					females += wardData.females[femaleKeys[i]];
				}

				return { totalMales: males, totalFemales: females };
			}

			return { totalMales: 0, totalFemales: 0 };
		}

		// Handle Local Authority Selection
		if (
			selectedArea &&
			selectedArea.type === "localAuthority" &&
			codeMapper?.getWardsForLad
		) {
			const ladCode = selectedArea.code;
			const cacheKey = `lad-${ladCode}`;

			if (!genderCache.has(cacheKey)) {
				genderCache.set(cacheKey, new Map());
			}
			const yearCache = genderCache.get(cacheKey)!;

			if (yearCache.has(dataset.year)) {
				return yearCache.get(dataset.year);
			}

			// Get all wards in this LAD
			const wardCodes = codeMapper.getWardsForLad(ladCode, 2024);

			if (wardCodes.length === 0) {
				const emptyResult = { totalMales: 0, totalFemales: 0 };
				yearCache.set(dataset.year, emptyResult);
				return emptyResult;
			}

			let aggregatedMales = 0;
			let aggregatedFemales = 0;

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

				if (wardData) {
					// Sum males
					const maleKeys = Object.keys(wardData.males);
					for (let i = 0; i < maleKeys.length; i++) {
						aggregatedMales += wardData.males[maleKeys[i]];
					}

					// Sum females
					const femaleKeys = Object.keys(wardData.females);
					for (let i = 0; i < femaleKeys.length; i++) {
						aggregatedFemales += wardData.females[femaleKeys[i]];
					}
				}
			}

			const result = {
				totalMales: aggregatedMales,
				totalFemales: aggregatedFemales,
			};

			// Cache the result
			yearCache.set(dataset.year, result);
			return result;
		}

		// Unsupported area type or missing data
		return { totalMales: 0, totalFemales: 0 };
	}, [dataset, aggregatedData, selectedArea, codeMapper]);

	const total = totalMales + totalFemales;
	const hasData = total > 0;

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${isActive
					? "bg-violet-50/60 border-2 border-violet-300"
					: "bg-white/60 border-2 border-gray-200/80 hover:border-violet-300"
				}`}
			onClick={() =>
				setActiveViz({
					vizId: vizId,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<div className="flex items-center justify-between mb-0">
				<h3 className="text-xs font-bold">Gender [{dataset.year}]</h3>
				{hasData && (
					<span className="text-[10px] text-gray-600 mr-1">
						<span className="text-blue-600">
							{totalMales.toLocaleString()}
						</span>{" "}
						<span className="text-gray-500">/</span>{" "}
						<span className="text-pink-600">
							{totalFemales.toLocaleString()}
						</span>
						<span className="ml-2 text-gray-500">
							{(totalMales / (totalMales + totalFemales)).toFixed(
								4,
							)}
						</span>
					</span>
				)}
			</div>
			<GenderBalanceByAgeChart
				dataset={dataset}
				aggregatedData={aggregatedData}
				selectedArea={selectedArea}
				codeMapper={codeMapper}
			/>
		</div>
	);
}

export default memo(Gender);
