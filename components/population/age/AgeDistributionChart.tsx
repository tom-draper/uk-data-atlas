// components/population/age/AgeDistributionChart.tsx
import { AgeGroups } from '@lib/types';
import AgeGroupBar from '@/components/population/age/AgeGroupBar';
import { getAgeColor } from '@/lib/utils/ageDistribution';

interface AgeDistributionChartProps {
	ages: Array<{ age: number; count: number }>;
	total: number;
	ageGroups: AgeGroups;
	isActive: boolean;
}

export default function AgeDistributionChart({ ages, total, ageGroups, isActive }: AgeDistributionChartProps) {
	const maxCount = Math.max(...ages.map(a => a.count), 1);

	if (maxCount === 1) {
		return <div className="text-xs h-27 text-gray-400/80 text-center grid place-items-center">
			<div className="mb-4">
				No data available
			</div>
		</div>
	}

	return (
		<div className="mx-1 -mt-4">
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
							<div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[8px] rounded-xs px-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-100">
								{age}: {count.toLocaleString()}
							</div>
						</div>
					);
				})}
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
				{(Object.keys(ageGroups) as Array<keyof AgeGroups>).map(ageGroup => (
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