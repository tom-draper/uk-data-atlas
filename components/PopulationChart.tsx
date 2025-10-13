// components/PopulationChart.tsx
'use client';
import { PopulationWardData } from '@/lib/types';
import { useMemo } from 'react';

interface PopulationChartProps {
	population: PopulationWardData;
	wardCode: string;
	wardName: string;
	wardCodeMap: { [name: string]: string }; // The map to find the population code
}

export const PopulationChart = ({
	population,
	wardCode,
	wardName,
	wardCodeMap
}: PopulationChartProps) => {
	const populationStats = useMemo(() => {
		if (!population || Object.keys(population).length === 0) return null;

		const calculateTotal = (ageData: { [age: string]: number }) => {
			return Object.values(ageData).reduce((sum, count) => sum + count, 0);
		};

		const calculateAgeGroups = (ageData: { [age: string]: number }) => {
			const groups = { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0, };
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

		// Case 1: A specific ward is being hovered over.
		if (wardCode) {
			// Resolve the correct ward code for the population dataset.
			let resolvedPopCode = wardCode;
			if (!population[wardCode]) {
				const normalizedName = wardName?.toLowerCase().trim();
				resolvedPopCode = wardCodeMap[normalizedName] || '';
			}

			// If we found valid data for this specific ward, calculate its stats.
			if (resolvedPopCode && population[resolvedPopCode]) {
				const wardData = population[resolvedPopCode];
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
			} else {
				// Case 2: A ward was hovered, but we found no matching data.
				// Return null to show the "Hover over a ward..." message.
				return null;
			}
		} else {
			// Case 3: No specific ward is selected, so aggregate all wards for the location view.
			let totalPop = 0, malesPop = 0, femalesPop = 0;
			const aggregatedAgeGroups = {
				total: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 },
				males: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 },
				females: { '0-17': 0, '18-29': 0, '30-44': 0, '45-64': 0, '65+': 0 }
			};

			for (const [_, wardData] of Object.entries(population)) {
				totalPop += calculateTotal(wardData.total);
				malesPop += calculateTotal(wardData.males);
				femalesPop += calculateTotal(wardData.females);
				const wardAgeGroups = {
					total: calculateAgeGroups(wardData.total),
					males: calculateAgeGroups(wardData.males),
					females: calculateAgeGroups(wardData.females)
				};
				Object.keys(aggregatedAgeGroups.total).forEach((ageGroup: string) => {
					aggregatedAgeGroups.total[ageGroup as keyof typeof aggregatedAgeGroups.total] += wardAgeGroups.total[ageGroup as keyof typeof wardAgeGroups.total];
					aggregatedAgeGroups.males[ageGroup as keyof typeof aggregatedAgeGroups.males] += wardAgeGroups.males[ageGroup as keyof typeof wardAgeGroups.males];
					aggregatedAgeGroups.females[ageGroup as keyof typeof aggregatedAgeGroups.females] += wardAgeGroups.females[ageGroup as keyof typeof wardAgeGroups.females];
				});
			}

			return { total: totalPop, males: malesPop, females: femalesPop, ageGroups: aggregatedAgeGroups, isWardSpecific: false };
		}

	}, [population, wardCode, wardName, wardCodeMap]);

	const renderPopulationBar = (label: string, value: number, total: number, color: string) => {
		const percentage = total > 0 ? (value / total) * 100 : 0;
		return (
			<div className="flex items-center gap-2">
				<div className="w-16 text-[10px] font-medium text-gray-600">{label}</div>
				<div className="flex-1 flex items-center gap-2">
					<div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
						<div className="h-full transition-all" style={{ width: `${percentage}%`, backgroundColor: color }} />
					</div>
					<div className="w-14 text-[10px] font-bold text-right">{value.toLocaleString()}</div>
				</div>
			</div>
		);
	};

	if (!populationStats) {
		return (
			<div className="text-xs text-gray-400 py-2 text-center">
				Hover over a ward to see population data
			</div>
		);
	}

	const { total, males, females, ageGroups } = populationStats;

	return (
		<div className="space-y-3">
			{/* Total Population Overview */}
			<div className="bg-gradient-to-r from-blue-50 to-purple-50 p-2 rounded">
				<div className="text-xs font-bold text-gray-700 mb-2">
					Population Overview
					{populationStats.isWardSpecific && (
						<span className="ml-2 text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-semibold">WARD</span>
					)}
				</div>
				<div className="grid grid-cols-3 gap-2 text-center">
					<div>
						<div className="text-[10px] text-gray-500">Total</div>
						<div className="text-sm font-bold text-blue-600">{total.toLocaleString()}</div>
					</div>
					<div>
						<div className="text-[10px] text-gray-500">Males</div>
						<div className="text-sm font-bold text-indigo-600">{males.toLocaleString()}</div>
					</div>
					<div>
						<div className="text-[10px] text-gray-500">Females</div>
						<div className="text-sm font-bold text-pink-600">{females.toLocaleString()}</div>
					</div>
				</div>
			</div>

			{/* Age Distribution */}
			<div>
				<div className="text-xs font-bold text-gray-700 mb-2">Age Distribution</div>
				<div className="space-y-1.5">
					{renderPopulationBar('0-17', ageGroups.total['0-17'], total, '#10b981')}
					{renderPopulationBar('18-29', ageGroups.total['18-29'], total, '#3b82f6')}
					{renderPopulationBar('30-44', ageGroups.total['30-44'], total, '#8b5cf6')}
					{renderPopulationBar('45-64', ageGroups.total['45-64'], total, '#f59e0b')}
					{renderPopulationBar('65+', ageGroups.total['65+'], total, '#ef4444')}
				</div>
			</div>

			{/* Gender Breakdown by Age */}
			<div>
				<div className="text-xs font-bold text-gray-700 mb-2">Gender by Age Group</div>
				<div className="space-y-2">
					{Object.entries(ageGroups.total).map(([ageGroup, totalCount]) => {
						const maleCount = ageGroups.males[ageGroup as keyof typeof ageGroups.males] || 0;
						const femaleCount = ageGroups.females[ageGroup as keyof typeof ageGroups.females] || 0;
						const malePercentage = totalCount > 0 ? (maleCount / totalCount) * 100 : 0;
						return (
							<div key={ageGroup}>
								<div className="text-[9px] text-gray-500 mb-0.5">{ageGroup}</div>
								<div className="flex h-3 rounded overflow-hidden bg-gray-200">
									<div className="bg-indigo-500" style={{ width: `${malePercentage}%` }} title={`Males: ${maleCount.toLocaleString()}`} />
									<div className="bg-pink-500" style={{ width: `${100 - malePercentage}%` }} title={`Females: ${femaleCount.toLocaleString()}`} />
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
		</div>
	);
};