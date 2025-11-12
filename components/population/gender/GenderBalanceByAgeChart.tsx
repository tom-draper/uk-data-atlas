// components/population/gender/GenderBalanceByAgeChart.tsx
import { useMemo } from 'react';
import { AggregatedPopulationData, PopulationDataset } from '@/lib/types';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';

export interface GenderBalanceByAgeChartProps {
	dataset: PopulationDataset;
	aggregatedData: AggregatedPopulationData | null;
	wardCode: string;
	codeMapper: CodeMapper;
}

export default function GenderBalanceByAgeChart({
	dataset,
	aggregatedData,
	wardCode,
	codeMapper
}: GenderBalanceByAgeChartProps) {
	const ageData = useMemo(() => {
		const ageRange = Array.from({ length: 91 }, (_, i) => i);
		const data: Array<{ age: number; males: number; females: number }> = [];

		if (wardCode && dataset) {
			// Try to find the ward data - population uses 2021 codes
			const codesToTry = [
				wardCode,
				codeMapper.convertWardCode(wardCode, 2021)
			].filter((code): code is string => code !== null);

			for (const code of codesToTry) {
				if (dataset.populationData[code]) {
					const males = dataset.populationData[code].males;
					const females = dataset.populationData[code].females;

					for (const age of ageRange) {
						data.push({
							age,
							males: males[age.toString()] || 0,
							females: females[age.toString()] || 0
						});
					}
					break;
				}
			}
		} else if (aggregatedData) {
			return aggregatedData[2020].medianAge !== 0 ? aggregatedData[2020].genderAgeData : [];
		}

		return data;
	}, [wardCode, dataset, aggregatedData, codeMapper]);

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
					{ageData.map(({ age, males, females }) => {
						const total = males + females;
						const malePercentage = total > 0 ? (males / total) * 100 : 50;
						const femalePercentage = 100 - malePercentage;

						return (
							<div
								key={age}
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