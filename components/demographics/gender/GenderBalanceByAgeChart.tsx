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

// Pre-create age indices array (constant)
const AGE_INDICES = Array.from({ length: 91 }, (_, i) => i);

function GenderBalanceByAgeChart({
	dataset,
	aggregatedData,
	wardCode,
	constituencyCode,
	codeMapper
}: GenderBalanceByAgeChartProps) {
	// Memoize both data AND percentages to avoid recalculation on every render
	const { ageData, percentages } = useMemo(() => {
		// Early return for aggregated data case
		if (!wardCode && !constituencyCode && aggregatedData) {
			const data = aggregatedData[dataset.year].medianAge !== 0 
				? aggregatedData[dataset.year].genderAgeData 
				: [];
			
			// Pre-calculate percentages
			const pct = data.map(({ males, females }) => {
				const total = males + females;
				return total > 0 ? (males / total) * 100 : 50;
			});
			
			return { ageData: data, percentages: pct };
		}

		if (!wardCode || !dataset) {
			return { ageData: [], percentages: [] };
		}

		// Try to find the ward data
		const codesToTry = [
			wardCode,
			codeMapper.convertWardCode(wardCode, dataset.boundaryYear)
		].filter((code): code is string => code !== null);

		for (const code of codesToTry) {
			const wardData = dataset.populationData[code];
			if (wardData) {
				const { males, females } = wardData;
				const data: Array<{ age: number; males: number; females: number }> = new Array(91);
				const pct: number[] = new Array(91);

				// Single loop: build data AND calculate percentages
				for (let age = 0; age < 91; age++) {
					const ageStr = age.toString();
					const m = males[ageStr] || 0;
					const f = females[ageStr] || 0;
					const total = m + f;
					
					data[age] = { age, males: m, females: f };
					pct[age] = total > 0 ? (m / total) * 100 : 50;
				}
				
				return { ageData: data, percentages: pct };
			}
		}

		return { ageData: [], percentages: [] };
	}, [wardCode, constituencyCode, dataset, aggregatedData, codeMapper]);

	if (ageData.length === 0) {
		return (
			<div className="text-xs h-[111px] text-gray-400/80 text-center grid place-items-center">
				<div className="mb-4">No data available</div>
			</div>
		);
	}

	return (
		<div className="px-0.5 pt-0 -my-1">
			{/* Age labels */}
			<div className="flex justify-center text-[8px] text-gray-500 mt-0 mx-auto">
				<span>0</span>
			</div>

			<div className="relative rounded overflow-hidden">
				{/* Center line - using transform for GPU */}
				<div 
					className="absolute top-0 bottom-0 w-px bg-gray-300 z-10 translate-x-1/2 left-1/2"
					style={{ marginLeft: '-1px' }}
				/>

				{/* Stack of age rows - Minimal DOM, maximum performance */}
				<div className="relative will-change-contents">
					{AGE_INDICES.map((age) => {
						const data = ageData[age];
						if (!data) return null;

						const { males, females } = data;
						const total = males + females;
						
						if (total === 0) {
							return <div key={age} className="h-px" />;
						}

						const malePercentage = percentages[age];
						const femalePercentage = 100 - malePercentage;

						// Use inline styles for dynamic values (faster than recalculating classes)
						return (
							<div
								key={age}
								className="flex h-px group relative"
								title={`Age ${age}: ${males.toLocaleString()}M / ${females.toLocaleString()}F`}
							>
								{/* Males (left) - minimal inline styles */}
								<div
									className="bg-blue-400"
									style={{ width: `${malePercentage}%` }}
								/>

								{/* Females (right) */}
								<div
									className="bg-pink-400"
									style={{ width: `${femalePercentage}%` }}
								/>

								{/* Tooltip - only visible on hover, uses transform for GPU */}
								<div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 bg-gray-800 text-white text-[8px] rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20 transition-opacity">
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

// Strict memo comparison - only re-render if these specific props change
export default memo(GenderBalanceByAgeChart, (prev, next) => {
	return (
		prev.wardCode === next.wardCode &&
		prev.constituencyCode === next.constituencyCode &&
		prev.dataset.year === next.dataset.year &&
		prev.dataset.type === next.dataset.type
	);
});