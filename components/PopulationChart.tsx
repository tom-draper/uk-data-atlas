// components/PopulationChart.tsx
'use client';
import { PopulationWardData } from '@/lib/types';
import { useMemo } from 'react';

interface PopulationChartProps {
	population: PopulationWardData;
	wardCode: string;
	wardName: string;
	wardCodeMap: { [name: string]: string };
}

interface AgeGroups {
	'0-17': number;
	'18-29': number;
	'30-44': number;
	'45-64': number;
	'65+': number;
}

interface PopulationStats {
	total: number;
	males: number;
	females: number;
	ageGroups: {
		total: AgeGroups;
		males: AgeGroups;
		females: AgeGroups;
	};
	isWardSpecific: boolean;
}

// Utility functions
const calculateTotal = (ageData: { [age: string]: number }): number => {
	return Object.values(ageData).reduce((sum, count) => sum + count, 0);
};

const calculateAgeGroups = (ageData: { [age: string]: number }): AgeGroups => {
	const groups: AgeGroups = { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 };
	
	Object.entries(ageData).forEach(([age, count]) => {
		const ageNum = parseInt(age);
		if (ageNum <= 17) groups['0-17'] += count;
		else if (ageNum <= 29) groups['18-29'] += count;
		else if (ageNum <= 44) groups['30-44'] += count;
		else if (ageNum <= 64) groups['45-64'] += count;
		else groups['65+'] += count;
	});
	
	return groups;
};

const resolveWardCode = (
	wardCode: string,
	wardName: string,
	population: PopulationWardData,
	wardCodeMap: { [name: string]: string }
): string => {
	if (population[wardCode]) return wardCode;
	const normalizedName = wardName?.toLowerCase().trim();
	return wardCodeMap[normalizedName] || '';
};

const getAgeColor = (age: number): string => {
	if (age <= 17) return '#10b981';
	if (age <= 29) return '#3b82f6';
	if (age <= 44) return '#8b5cf6';
	if (age <= 64) return '#f59e0b';
	return '#ef4444';
};

// Sub-components
const PopulationBar = ({ label, value, total, color }: { 
	label: string; 
	value: number; 
	total: number; 
	color: string;
}) => {
	const percentage = total > 0 ? (value / total) * 100 : 0;
	
	return (
		<div className="flex items-center gap-2">
			<div className="w-16 text-[10px] font-medium text-gray-600">{label}</div>
			<div className="flex-1 flex items-center gap-2">
				<div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
					<div 
						className="h-full transition-all" 
						style={{ width: `${percentage}%`, backgroundColor: color }} 
					/>
				</div>
				<div className="w-14 text-[10px] font-bold text-right">
					{value.toLocaleString()}
				</div>
			</div>
		</div>
	);
};

const PopulationSummary = ({ total, males, females }: { 
	total: number; 
	males: number; 
	females: number;
}) => (
	<div className="p-2 h-[95px] rounded transition-all cursor-pointer bg-gray-50 border-2 border-gray-200">
		<div className="flex items-center justify-between mb-5">
			<h3 className="text-xs font-bold">Population (2020)</h3>
		</div>
		<div className="grid grid-cols-3 gap-2 text-center">
			<div>
				<div className="text-[10px] text-gray-500">Total</div>
				<div className="text-sm font-bold text-green-600">{total.toLocaleString()}</div>
			</div>
			<div>
				<div className="text-[10px] text-gray-500">Males</div>
				<div className="text-sm font-bold text-blue-600">{males.toLocaleString()}</div>
			</div>
			<div>
				<div className="text-[10px] text-gray-500">Females</div>
				<div className="text-sm font-bold text-pink-600">{females.toLocaleString()}</div>
			</div>
		</div>
	</div>
);

const NoDataView = () => (
	<div className="p-2 h-[95px] rounded transition-all cursor-pointer bg-gray-50 border-2 border-gray-200">
		<div className="flex items-center justify-between mb-1.5">
			<h3 className="text-xs font-bold">Population (2020)</h3>
		</div>
		<div className="text-xs text-gray-400 pt-3 text-center">
			No data available
		</div>
	</div>
);

const AgeDistributionChart = ({ 
	ageData, 
	total, 
	ageGroups 
}: { 
	ageData: { [age: string]: number }; 
	total: number;
	ageGroups: AgeGroups;
}) => {
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
		<div className="mx-2">
			<div className="text-xs font-bold text-gray-700 mb-[-10px]">Age Distribution</div>
			
			{/* Detailed Age Chart */}
			<div className="flex items-end h-32 overflow-x-hidden pt-4">
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
};

const GenderBreakdown = ({ ageGroups }: { 
	ageGroups: { total: AgeGroups; males: AgeGroups; females: AgeGroups } 
}) => (
	<div className="px-2">
		<div className="text-xs font-bold text-gray-700 mb-2">Gender by Age Group</div>
		<div className="space-y-1">
			{(Object.entries(ageGroups.total) as [keyof AgeGroups, number][]).map(([ageGroup, totalCount]) => {
				const maleCount = ageGroups.males[ageGroup] || 0;
				const femaleCount = ageGroups.females[ageGroup] || 0;
				const malePercentage = totalCount > 0 ? (maleCount / totalCount) * 100 : 0;

				return (
					<div key={ageGroup}>
						<div className="text-[9px] text-gray-500 mb-0.5">{ageGroup}</div>
						<div className="flex h-3 rounded overflow-hidden bg-gray-200">
							<div 
								className="bg-blue-500" 
								style={{ width: `${malePercentage}%` }} 
								title={`Males: ${maleCount.toLocaleString()}`} 
							/>
							<div 
								className="bg-pink-500" 
								style={{ width: `${100 - malePercentage}%` }} 
								title={`Females: ${femaleCount.toLocaleString()}`} 
							/>
						</div>
						<div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
							<span>M: {maleCount.toLocaleString()}</span>
							<span>F: {femaleCount.toLocaleString()}</span>
						</div>
					</div>
				);
			})}
		</div>
	</div>
);

// Main component
export default function PopulationChart({
	population,
	wardCode,
	wardName,
	wardCodeMap
}: PopulationChartProps) {
	const populationStats = useMemo((): PopulationStats | null => {
		if (!population || Object.keys(population).length === 0) return null;

		// Ward-specific data
		if (wardCode) {
			const resolvedCode = resolveWardCode(wardCode, wardName, population, wardCodeMap);
			
			if (resolvedCode && population[resolvedCode]) {
				const wardData = population[resolvedCode];
				return {
					total: calculateTotal(wardData.total),
					males: calculateTotal(wardData.males),
					females: calculateTotal(wardData.females),
					ageGroups: {
						total: calculateAgeGroups(wardData.total),
						males: calculateAgeGroups(wardData.males),
						females: calculateAgeGroups(wardData.females),
					},
					isWardSpecific: true
				};
			}
			
			return null;
		}

		// Aggregate all wards
		let totalPop = 0, malesPop = 0, femalesPop = 0;
		const aggregatedAgeGroups = {
			total: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups,
			males: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups,
			females: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 } as AgeGroups
		};

		for (const wardData of Object.values(population)) {
			totalPop += calculateTotal(wardData.total);
			malesPop += calculateTotal(wardData.males);
			femalesPop += calculateTotal(wardData.females);
			
			const wardAgeGroups = {
				total: calculateAgeGroups(wardData.total),
				males: calculateAgeGroups(wardData.males),
				females: calculateAgeGroups(wardData.females)
			};

			(Object.keys(aggregatedAgeGroups.total) as Array<keyof AgeGroups>).forEach(ageGroup => {
				aggregatedAgeGroups.total[ageGroup] += wardAgeGroups.total[ageGroup];
				aggregatedAgeGroups.males[ageGroup] += wardAgeGroups.males[ageGroup];
				aggregatedAgeGroups.females[ageGroup] += wardAgeGroups.females[ageGroup];
			});
		}

		return { 
			total: totalPop, 
			males: malesPop, 
			females: femalesPop, 
			ageGroups: aggregatedAgeGroups, 
			isWardSpecific: false 
		};
	}, [population, wardCode, wardName, wardCodeMap]);

	const ageData = useMemo(() => {
		const data: { [age: string]: number } = {};

		if (wardCode) {
			const resolvedCode = resolveWardCode(wardCode, wardName, population, wardCodeMap);
			if (resolvedCode && population[resolvedCode]) {
				return population[resolvedCode].total;
			}
		} else {
			for (const wardData of Object.values(population)) {
				Object.entries(wardData.total).forEach(([age, count]) => {
					data[age] = (data[age] || 0) + count;
				});
			}
		}

		return data;
	}, [population, wardCode, wardName, wardCodeMap]);

	if (!populationStats) {
		return <NoDataView />;
	}

	const { total, males, females, ageGroups } = populationStats;

	return (
		<div className="space-y-3">
			<PopulationSummary total={total} males={males} females={females} />
			<AgeDistributionChart ageData={ageData} total={total} ageGroups={ageGroups.total} />
			<GenderBreakdown ageGroups={ageGroups} />
		</div>
	);
}