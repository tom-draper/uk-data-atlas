// components/population/age/AgeDistributionChart.tsx
import { AgeGroups } from '@/lib/types';
import { getAgeColor } from '@/lib/helpers/ageDistribution';
import { memo } from 'react';
import AgeGroupBar from './AgeGroupBar';

interface AgeDistributionChartProps {
	counts: Uint32Array | number[];
	maxCount: number;
	total: number;
	ageGroups: AgeGroups;
	isActive: boolean;
}

const AGE_GROUP_ORDER: Array<keyof AgeGroups> = ['0-17', '18-29', '30-44', '45-64', '65+'];

// Helper to generate a dummy array for mapping (0-99)
const AGE_INDICES = Array.from({ length: 100 }, (_, i) => i);

function AgeDistributionChart({ counts, maxCount, total, ageGroups, isActive }: AgeDistributionChartProps) {
	if (!total || maxCount === 0) {
		return (
			<div className="text-xs h-25 text-gray-400/80 text-center grid place-items-center">
				<div className="mb-4">No data available</div>
			</div>
		);
	}

	return (
		<div className="mx-1 -mt-4">
			<div 
				className="flex items-end h-26 overflow-x-hidden pt-4"
				style={{ 
					contain: 'layout style paint'
				}}
			>
				{AGE_INDICES.map((age) => {
					const count = counts[age] || 0;
					const scale = maxCount > 0 ? count / maxCount : 0;

					// Skip rendering bars with no data to reduce DOM nodes
					if (count === 0) {
						return <div key={age} className="flex-1" />;
					}

					return (
						<div
							key={age}
							className="flex-1 hover:opacity-80 transition-opacity relative group"
							title={`Age ${age}: ${count.toLocaleString()}`}
							style={{
								height: '100%',
							}}
						>
							<div
								className="w-full h-full origin-bottom"
								style={{
									backgroundColor: getAgeColor(age),
									// translateZ(0) forces GPU layer without will-change issues
									transform: `scaleY(${scale}) translateZ(0)`,
									minHeight: scale > 0 ? '2px' : '0',
									// Optimize paint operations
									backfaceVisibility: 'hidden',
									WebkitBackfaceVisibility: 'hidden'
								}}
							/>
						</div>
					);
				})}
			</div>

			{/* Age axis labels */}
			<div className="flex justify-between text-[8px] text-gray-500 mt-1 -mb-1">
				<span>0</span><span>25</span><span>50</span><span>75</span><span>99</span>
			</div>

			{/* Age group bars - Collapsible container */}
			<div
				className={`space-y-1.5 overflow-hidden transition-all duration-300 ${isActive ? 'mt-3' : ''}`}
				style={{
					maxHeight: isActive ? '104px' : '0px',
					opacity: isActive ? 1 : 0
				}}
			>
				{/* Only render contents if active to save layout time on inactive charts */}
				{isActive && AGE_GROUP_ORDER.map(ageGroup => (
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

// Optimized equality check for props to prevent unnecessary renders
export default memo(AgeDistributionChart, (prev, next) => {
	// Fast path: if counts array reference is the same, nothing changed
	return (
		prev.counts === next.counts && 
		prev.maxCount === next.maxCount &&
		prev.isActive === next.isActive &&
		prev.total === next.total
	) 
});