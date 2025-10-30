// components/population/AgeDistributionChart.tsx
import { useMemo } from 'react';
import { AgeGroups } from '@lib/types';
import { getAgeColor } from '@lib/utils/populationHelpers';
import PopulationBar from '@components/population/PopulationBar';

interface AgeDistributionChartProps {
	ageData: { [age: string]: number };
	total: number;
	ageGroups: AgeGroups;
}

export default function AgeDistributionChart({ ageData, total, ageGroups }: AgeDistributionChartProps) {
	const ages = useMemo(() => {
		const ageArray = Array.from({ length: 100 }, (_, i) => ({
			age: i,
			count: ageData[i.toString()] || 0
		}));

		// Distribute 90+ population with exponential decay
		const age90Plus = ageArray[90].count;
		const decayRate = 0.15;
		const weights = Array.from({ length: 10 }, (_, i) => Math.exp(-decayRate * i));
		const totalWeight = weights.reduce((sum, w) => sum + w, 0);

		for (let i = 90; i < 100; i++) {
			const weight = weights[i - 90];
			ageArray[i] = { age: i, count: (age90Plus * weight) / totalWeight };
		}

		return ageArray;
	}, [ageData]);

	const maxCount = Math.max(...ages.map(a => a.count), 1);

	return (
		<div className="mx-1 -mt-4">
			{/* <div className="text-xs font-bold text-gray-700 -mb-2.5">Age Distribution</div> */}

			{/* Detailed Age Chart */}
			<div className="flex items-end h-28 overflow-x-hidden pt-4">
				{ages.map(({ age, count }) => {
					const heightPercentage = (count / maxCount) * 100;
					const color = getAgeColor(age);

					return (
						<div
							key={age}
							className="flex-1 hover:opacity-80 transition-opacity relative group"
							style={{
								height: `${heightPercentage}%`,
								backgroundColor: color,
								minHeight: count > 0 ? '2px' : '0'
							}}
							title={`Age ${age}: ${count.toLocaleString()}`}
						>
							<div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[8px] rounded-xs px-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-[100]">
								{age}: {count.toLocaleString()}
							</div>
						</div>
					);
				})}
			</div>

			{/* Age axis labels */}
			<div className="flex justify-between text-[8px] text-gray-500 mt-1 mb-2">
				<span>0</span>
				<span>25</span>
				<span>50</span>
				<span>75</span>
				<span>99</span>
			</div>

			{/* Age group bars */}
			<div className="space-y-1.5">
				{(Object.keys(ageGroups) as Array<keyof AgeGroups>).map(ageGroup => (
					<PopulationBar
						key={ageGroup}
						label={ageGroup}
						value={ageGroups[ageGroup]}
						total={total}
						color={getAgeColor(parseInt(ageGroup.split('-')[0]))}
					/>
				))}
			</div>
		</div>
	);
}