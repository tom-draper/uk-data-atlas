// components/population/gender/Gender.tsx
import { useMemo, memo, useCallback } from "react";
import { AggregatedPopulationData, PopulationDataset } from "@/lib/types";
import GenderBalanceByAgeChart from "./GenderBalanceByAgeChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface GenderProps {
	dataset: PopulationDataset;
	aggregatedData: AggregatedPopulationData | null;
	wardCode?: string;
	constituencyCode?: string;
	setActiveDatasetId: (datasetId: string) => void;
	activeDatasetId: string;
	codeMapper: CodeMapper;
}

function Gender({
	dataset,
	aggregatedData,
	wardCode,
	constituencyCode,
	setActiveDatasetId,
	activeDatasetId,
	codeMapper
}: GenderProps) {
	const isActive = activeDatasetId === 'gender';

	// Calculate total males and females
	const { totalMales, totalFemales } = useMemo(() => {
		// Early return for aggregated data case
		if (!wardCode && !constituencyCode && aggregatedData) {
			return { 
				totalMales: aggregatedData[2020].populationStats.males, 
				totalFemales: aggregatedData[2020].populationStats.females 
			};
		}

		if (!wardCode || !dataset) {
			return { totalMales: 0, totalFemales: 0 };
		}

		// Try to find the ward data - population uses 2021 codes
		const codesToTry = [
			wardCode,
			codeMapper.convertWardCode(wardCode, 2021)
		].filter((code): code is string => code !== null);

		for (const code of codesToTry) {
			const wardData = dataset.populationData[code];
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
		}

		return { totalMales: 0, totalFemales: 0 };
	}, [dataset, wardCode, constituencyCode, aggregatedData, codeMapper]);

	// Memoize the click handler to prevent GenderBalanceByAgeChart re-renders
	const handleClick = useCallback(() => {
		setActiveDatasetId('gender');
	}, [setActiveDatasetId]);

	const total = totalMales + totalFemales;
	const hasData = total > 0;

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${
				isActive
					? 'bg-emerald-50/60 border-2 border-emerald-300'
					: 'bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300'
			}`}
			onClick={handleClick}
		>
			<div className="flex items-center justify-between mb-0">
				<h3 className="text-xs font-bold">Gender (2020)</h3>
				{hasData && (
					<span className="text-[10px] text-gray-600 mr-1">
						<span className="text-blue-600">{totalMales.toLocaleString()}</span>
						{' '}<span className="text-gray-500">/</span>{' '}
						<span className="text-pink-600">{totalFemales.toLocaleString()}</span>
					</span>
				)}
			</div>
			<GenderBalanceByAgeChart
				dataset={dataset}
				aggregatedData={aggregatedData}
				wardCode={wardCode}
				constituencyCode={constituencyCode}
				codeMapper={codeMapper}
			/>
		</div>
	);
}

export default memo(Gender);