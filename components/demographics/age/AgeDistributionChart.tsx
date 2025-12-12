// components/population/age/AgeDistributionChart.tsx
import { AgeGroups } from '@/lib/types';
import { getAgeColor } from '@/lib/utils/ageDistribution';
import { memo } from 'react';
import AgeGroupBar from './AgeGroupBar';

interface AgeDistributionChartProps {
	counts: Uint32Array | number[]; // Simple array
	maxCount: number;
	total: number;
	ageGroups: AgeGroups;
	isActive: boolean;
}

const AGE_GROUP_ORDER: Array<keyof AgeGroups> = ['0-17', '18-29', '30-44', '45-64', '65+'];

// Helper to generate a dummy array for mapping (0-99)
// Created once effectively acting as a static index
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
			{/* PERFORMANCE NOTES:
                1. `items-end`: Aligns bars to bottom
                2. `will-change-transform`: Hints browser to promote to GPU layer
            */}
			<div className="flex items-end h-26 overflow-x-hidden pt-4">
				{AGE_INDICES.map((age) => {
					const count = counts[age] || 0;
					const scale = maxCount > 0 ? count / maxCount : 0;

					// 1. The structural container (defines width and full height)
					return (
						<div
							key={age}
							// className="relative w-0.5" // Remove bg-gray-200 from here
							className="flex-1 hover:opacity-80 transition-opacity relative group"
							title={`Age ${age}: ${count.toLocaleString()}`}
							style={{
								height: '100%',
							}}
						>
							{/* 2. The Scaler element (applies color and vertical scaling) */}
							<div
								// className="w-full h-full origin-bottom will-change-transform"
								// className="w-full h-full origin-bottom will-change-transform border-r border-r-transparent"
								className="w-full h-full origin-bottom border-r border-r-transparent"

								style={{
									// Apply the background color here, to the element that is scaled
									backgroundColor: getAgeColor(age),
									// Apply the transform scale
									transform: `scaleY(${scale})`,
									// Add min height equivalent to '2px' to ensure visibility for small bars
									minHeight: scale > 0 ? '2px' : '0'
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
				className={`space-y-1.5 overflow-hidden ${isActive ? 'mt-3' : ''}`}
				style={{
					maxHeight: isActive ? '104px' : '0px',
					opacity: isActive ? 1 : 0
				}}
			>
				{/* Only render contents if active to save layout time on inactive charts 
                   (Optional optimization, remove check if you want animation)
                */}
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

// Simple equality check for props to prevent unnecessary renders
export default memo(AgeDistributionChart, (prev, next) => {
	return (
		prev.maxCount === next.maxCount &&
		prev.isActive === next.isActive &&
		prev.total === next.total &&
		prev.counts === next.counts // Works if parent maintains reference or we use primitive checks
	);
});