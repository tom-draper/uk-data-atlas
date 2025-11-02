// components/population/GenderBalanceByAge.tsx
import { useMemo } from 'react';
import { PopulationWardData } from '@/lib/types';
import { resolveWardCode } from '@/lib/utils/populationHelpers';

export interface GenderBalanceByAgeProps {
	population: PopulationWardData;
	wardCode: string;
	wardName: string;
	wardCodeMap: { [name: string]: string };
}

export default function GenderBalanceByAge({ population, wardCode, wardName, wardCodeMap }: GenderBalanceByAgeProps) {
	const resolvedCode = resolveWardCode(wardCode, wardName, population, wardCodeMap);

	// Collect raw male/female per age (0-90)
	const ageData = useMemo(() => {
		const ageRange = Array.from({ length: 91 }, (_, i) => i);
		const data: Array<{ age: number; males: number; females: number }> = [];

		if (resolvedCode && population[resolvedCode]) {
			const males = population[resolvedCode].males;
			const females = population[resolvedCode].females;

			for (const age of ageRange) {
				data.push({
					age,
					males: males[age.toString()] || 0,
					females: females[age.toString()] || 0
				});
			}
		} else if (!wardCode) {
			const aggregate = { males: {} as Record<string, number>, females: {} as Record<string, number> };

			for (const ward of Object.values(population)) {
				Object.entries(ward.males).forEach(([age, count]) => {
					aggregate.males[age] = (aggregate.males[age] || 0) + count;
				});
				Object.entries(ward.females).forEach(([age, count]) => {
					aggregate.females[age] = (aggregate.females[age] || 0) + count;
				});
			}

			for (const age of ageRange) {
				data.push({
					age,
					males: aggregate.males[age.toString()] || 0,
					females: aggregate.females[age.toString()] || 0
				});
			}
		}

		return data;
	}, [population, wardCode, wardName, wardCodeMap, resolvedCode]);

	if (ageData.length === 0) {
		return <div className="text-xs h-[111px] text-gray-400 text-center grid place-items-center">
			<div className="mb-4">
				No data available
			</div>
		</div>
	}

	return (
		<div className="px-1 pt-0 -my-1">
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
			<div className="flex justify-center text-[8px] text-gray-500 mt-1">
				<span>90</span>
			</div>
		</div>
	);
}