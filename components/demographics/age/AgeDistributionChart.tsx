// components/population/age/AgeDistributionChart.tsx
import { AgeGroups } from '@lib/types';
import { getAgeColor } from '@/lib/utils/ageDistribution';
import { useMemo, memo } from 'react';
import AgeGroupBar from './AgeGroupBar';

interface AgeDistributionChartProps {
	ages: Array<{ age: number; count: number }>;
	total: number;
	ageGroups: AgeGroups;
	isActive: boolean;
}

// Pre-calculate age group order (constant)
const AGE_GROUP_ORDER: Array<keyof AgeGroups> = ['0-17', '18-29', '30-44', '45-64', '65+'];

// Memoized age bar component
const AgeBar = memo(({ 
	age, 
	count, 
	heightPercentage, 
	color 
}: { 
	age: number; 
	count: number; 
	heightPercentage: number; 
	color: string;
}) => (
	<div
		className="flex-1 hover:opacity-80 transition-opacity relative group"
		style={{
			height: `${heightPercentage}%`,
			backgroundColor: color,
			minHeight: count > 0 ? '2px' : '0'
		}}
		title={`Age ${age}: ${count.toLocaleString()}`}
	>
		<div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[8px] rounded-xs px-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100">
			{age}: {count.toLocaleString()}
		</div>
	</div>
));

AgeBar.displayName = 'AgeBar';

function AgeDistributionChart({ ages, total, ageGroups, isActive }: AgeDistributionChartProps) {
	// Memoize max calculation and bar data
	const { maxCount, barData } = useMemo(() => {
		let max = 1;
		for (let i = 0; i < ages.length; i++) {
			if (ages[i].count > max) {
				max = ages[i].count;
			}
		}

		// Pre-calculate all bar properties
		const bars = new Array(ages.length);
		for (let i = 0; i < ages.length; i++) {
			const { age, count } = ages[i];
			bars[i] = {
				age,
				count,
				heightPercentage: (count / max) * 100,
				color: getAgeColor(age)
			};
		}

		return { maxCount: max, barData: bars };
	}, [ages]);

	if (maxCount === 1) {
		return <div className="text-xs h-25 text-gray-400/80 text-center grid place-items-center">
			<div className="mb-4">
				No data available
			</div>
		</div>
	}

	return (
		<div className="mx-1 -mt-4">
			{/* Detailed Age Chart */}
			<div className="flex items-end h-26 overflow-x-hidden pt-4">
				{barData.map(({ age, count, heightPercentage, color }) => (
					<AgeBar 
						key={age} 
						age={age} 
						count={count} 
						heightPercentage={heightPercentage} 
						color={color} 
					/>
				))}
			</div>

			{/* Age axis labels */}
			<div className="flex justify-between text-[8px] text-gray-500 mt-1 -mb-1">
				<span>0</span>
				<span>25</span>
				<span>50</span>
				<span>75</span>
				<span>99</span>
			</div>

			{/* Age group bars */}
			<div
				className={`space-y-1.5 transition-all duration-300 ease-in-out cursor-pointer overflow-hidden ${isActive ? 'mt-3' : ''}`}
				style={{
					maxHeight: isActive ? '104px' : '0px',
					opacity: isActive ? 1 : 0
				}}
			>
				{AGE_GROUP_ORDER.map(ageGroup => (
					<AgeGroupBar
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

export default memo(AgeDistributionChart);