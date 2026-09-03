// components/population/gender/Gender.tsx
import {
	ActiveViz,
	AggregatedPopulationData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";
import GenderBalanceByAgeChart from "./GenderBalanceByAgeChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { ChartCard } from "@/components/ChartCard";

const MALE_COLOR = "#60a5fa"; // blue-400, matches chart bars
const FEMALE_COLOR = "#f472b6"; // pink-400, matches chart bars

interface GenderProps {
	dataset: PopulationDataset;
	aggregatedData: Record<number, AggregatedPopulationData> | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: CodeMapper;
}

// Cache for LAD gender aggregations (bounded to prevent unbounded memory growth)
const MAX_LAD_CACHE_ENTRIES = 50;
const genderCache = new Map<string, Map<number, any>>();

function Gender({
	dataset,
	aggregatedData,
	selectedArea,
	activeViz,
	setActiveViz,
	codeMapper,
}: GenderProps) {
	const isActive =
		activeViz.datasetId === dataset.id && activeViz.view === "gender";

	const { totalMales, totalFemales } = (() => {
		// Handle no area selected - use aggregated data
		if (selectedArea === null && aggregatedData) {
			const data = aggregatedData[dataset.year];
			if (!data) return { totalMales: null, totalFemales: null };
			return {
				totalMales: data.populationStats.males,
				totalFemales: data.populationStats.females,
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
				if (genderCache.size >= MAX_LAD_CACHE_ENTRIES) {
					genderCache.delete(genderCache.keys().next().value!);
				}
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

		// Handle Constituency Selection
		if (
			selectedArea &&
			selectedArea.type === "constituency" &&
			codeMapper?.getWardsForConstituency
		) {
			const wardCodes = codeMapper.getWardsForConstituency(
				selectedArea.code,
				dataset.boundaryYear,
			);

			let aggregatedMales = 0;
			let aggregatedFemales = 0;

			for (const wardCode of wardCodes) {
				let wardData = dataset.data?.[wardCode];
				if (!wardData && codeMapper?.getCodeForYear) {
					const mapped = codeMapper.getCodeForYear(
						"ward",
						wardCode,
						dataset.boundaryYear,
					);
					if (mapped) wardData = dataset.data[mapped];
				}
				if (wardData) {
					for (const v of Object.values(wardData.males))
						aggregatedMales += v;
					for (const v of Object.values(wardData.females))
						aggregatedFemales += v;
				}
			}

			return {
				totalMales: aggregatedMales,
				totalFemales: aggregatedFemales,
			};
		}

		// Unsupported area type or missing data
		return { totalMales: 0, totalFemales: 0 };
	})();

	const total = (totalMales ?? 0) + (totalFemales ?? 0);
	const hasData = total > 0;

	const accentColor = !hasData
		? null
		: (totalMales ?? 0) >= (totalFemales ?? 0)
			? MALE_COLOR
			: FEMALE_COLOR;
	return (
		<ChartCard
			heading={`Gender [${dataset.year}]`}
			headerEnd={
				hasData && (
					<span className="text-[10px] text-gray-600 mr-1">
						<span className="text-blue-600">
							{totalMales.toLocaleString()}
						</span>{" "}
						<span className="text-gray-500">/</span>{" "}
						<span className="text-pink-600">
							{totalFemales.toLocaleString()}
						</span>
						<span className="ml-2 text-gray-500">
							{(totalMales / (totalMales + totalFemales)).toFixed(4)}
						</span>
					</span>
				)
			}
			accent={accentColor}
			isActive={isActive}
			title="Office for National Statistics. Census 2021: Sex, Age and Legal Partnership Status, England and Wales. ons.gov.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					view: "gender",
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<GenderBalanceByAgeChart
				dataset={dataset}
				aggregatedData={aggregatedData}
				selectedArea={selectedArea}
				codeMapper={codeMapper}
			/>
		</ChartCard>
	);
}

export default Gender;
