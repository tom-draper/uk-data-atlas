// components/population/gender/GenderBalanceByAgeChart.tsx
import { useMemo, memo } from 'react';
import { AggregatedPopulationData, PopulationDataset } from '@/lib/types';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';

export interface GenderBalanceByAgeChartProps {
	dataset: PopulationDataset;
	aggregatedData: AggregatedPopulationData | null;
	wardCode?: string;
	constituencyCode?: string;
	codeMapper: CodeMapper;
}

// Memoized row component to prevent unnecessary re-renders
const AgeRow = memo(({ 
	age, 
	males, 
	females 
}: { 
	age: number; 
	males: number; 
	females: number 
}) => {
	const total = males + females;
	const malePercentage = total > 0 ? (males / total) * 100 : 50;
	const femalePercentage = 100 - malePercentage;

	return (
		<div
			className="flex h-px group relative"
			title={`Age ${age}: ${males.toLocaleString()} males, ${females.toLocaleString()} females`}
		>
			{/* Males (left side - blue) */}
			<div
				className="bg-blue-400"
				style={{ width: `${malePercentage}%` }}
			/>

			{/* Females (right side - pink) */}
			<div
				className="bg-pink-400"
				style={{ width: `${femalePercentage}%` }}
			/>

			{/* Tooltip on hover */}
			<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 bg-gray-800 text-white text-[8px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20">
				Age {age}: {males.toLocaleString()}M / {females.toLocaleString()}F ({malePercentage.toFixed(1)}% male)
			</div>
		</div>
	);
});
AgeRow.displayName = 'AgeRow';

function GenderBalanceByAgeChart({
	dataset,
	aggregatedData,
	wardCode,
	constituencyCode,
	codeMapper
}: GenderBalanceByAgeChartProps) {
	const ageData = useMemo(() => {
		// Early return for aggregated data case
		if (!wardCode && !constituencyCode && aggregatedData) {
			return aggregatedData[dataset.year].medianAge !== 0 ? aggregatedData[dataset.year].genderAgeData : [];
		}

		if (!wardCode || !dataset) {
			return [];
		}

		// Try to find the ward data - population uses 2021 codes
		const codesToTry = [
			wardCode,
			codeMapper.convertWardCode(wardCode, dataset.boundaryYear)
		].filter((code): code is string => code !== null);

		for (const code of codesToTry) {
			const wardData = dataset.populationData[code];
			if (wardData) {
				const { males, females } = wardData;
				const data: Array<{ age: number; males: number; females: number }> = new Array(91);

				// Single loop with direct array assignment
				for (let age = 0; age < 91; age++) {
					const ageStr = age.toString();
					data[age] = {
						age,
						males: males[ageStr] || 0,
						females: females[ageStr] || 0
					};
				}
				return data;
			}
		}

		return [];
	}, [wardCode, constituencyCode, dataset, aggregatedData, codeMapper]);

	if (ageData.length === 0) {
		return <div className="text-xs h-[111px] text-gray-400/80 text-center grid place-items-center">
			<div className="mb-4">
				No data available
			</div>
		</div>
	}

	return (
		<div className="px-0.5 pt-0 -my-1">
			{/* Age labels */}
			<div className="flex justify-center text-[8px] text-gray-500 mt-0 mx-auto">
				<span>0</span>
			</div>

			<div className="relative rounded overflow-hidden">
				{/* Center line */}
				<div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 z-10" style={{ marginLeft: '-0.5px' }} />

				{/* Stack of age rows */}
				<div className="relative">
					{ageData.map(({ age, males, females }) => (
						<AgeRow key={age} age={age} males={males} females={females} />
					))}
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