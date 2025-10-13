// components/ChartPanel.tsx
'use client';
import { ChartData, Dataset, PopulationWardData } from '@/lib/types';
import { useMemo } from 'react';

interface ChartPanelProps {
	title: string;
	wardCode: string;
	population: PopulationWardData;
	chartData2024: ChartData;
	chartData2023: ChartData;
	chartData2022: ChartData;
	chartData2021: ChartData;
	activeDataset: Dataset;
	availableDatasets: Dataset[];
	onDatasetChange: (datasetId: string) => void;
}

export const ChartPanel = ({
	title,
	wardCode,
	population,
	chartData2024,
	chartData2023,
	chartData2022,
	chartData2021,
	activeDataset,
	availableDatasets,
	onDatasetChange,
}: ChartPanelProps) => {
	const dataset2024 = availableDatasets.find(d => d.id === '2024');
	const dataset2023 = availableDatasets.find(d => d.id === '2023');
	const dataset2022 = availableDatasets.find(d => d.id === '2022');
	const dataset2021 = availableDatasets.find(d => d.id === '2021');

	// Calculate population statistics for the current ward or aggregated data
	const populationStats = useMemo(() => {
		if (Object.keys(population).length === 0) return null;

		const calculateTotal = (ageData: { [age: string]: number }) => {
			return Object.values(ageData).reduce((sum, count) => sum + count, 0);
		};

		const calculateAgeGroups = (ageData: { [age: string]: number }) => {
			const groups = {
				'0-17': 0,
				'18-29': 0,
				'30-44': 0,
				'45-64': 0,
				'65+': 0,
			};

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

		// If we have a specific ward, show that ward's data
		if (wardCode && population[wardCode]) {
			const wardData = population[wardCode];

			return {
				total: calculateTotal(wardData.total),
				males: calculateTotal(wardData.males),
				females: calculateTotal(wardData.females),
				ageGroups: {
					total: calculateAgeGroups(wardData.total),
					males: calculateAgeGroups(wardData.males),
					females: calculateAgeGroups(wardData.females),
				}
			};
		} else {
			const result = {
				total: 0,
				males: 0,
				females: 0,
				ageGroups: {
					total: {},
					males: {},
					females: {}
				}
			}
			for (const [wardCode, wardData] of Object.entries(population)) {
				result.total += calculateTotal(wardData.total);
				result.males += calculateTotal(wardData.males);
				result.females += calculateTotal(wardData.females);
				result.ageGroups.total = calculateAgeGroups(wardData.total);
				result.ageGroups.males = calculateAgeGroups(wardData.males);
				result.ageGroups.females = calculateAgeGroups(wardData.females);
			}

			return result;
		}
	}, [population, wardCode]);

	const renderCompactBar = (data: ChartData | undefined, dataset: Dataset) => {
		if (!data) {
			return <div className="text-xs text-gray-400 py-2">No data</div>;
		}

		const maxVotes = Math.max(
			data.LAB,
			data.CON,
			data.LD,
			data.GREEN,
			data.REF,
			data.IND
		);

		if (maxVotes === 0) {
			return <div className="text-xs text-gray-400 py-2">No data</div>;
		}

		const parties = dataset.partyInfo;
		const totalVotes = parties.reduce((sum, p) => sum + (data[p.key] || 0), 0);

		return (
			<div className="space-y-1">
				{/* Main bar showing all parties */}
				<div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0">
					{parties.map(party => {
						const votes = data[party.key] || 0;
						const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
						return (
							<div
								key={party.key}
								style={{
									width: `${percentage}%`,
									backgroundColor: party.color,
								}}
								title={`${party.name}: ${votes.toLocaleString()}`}
								className="group relative hover:opacity-80 transition-opacity"
							>
								{percentage > 12 && (
									<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate">
										{party.key}
									</span>
								)}
							</div>
						);
					})}
				</div>
				{/* Compact legend */}
				<div className="grid grid-cols-3 gap-0.5 text-[9px]">
					{parties.map(party => (
						<div key={party.key} className="flex items-center gap-1">
							<div
								className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
								style={{ backgroundColor: party.color }}
							/>
							<span className="truncate font-medium">
								{(data[party.key] || 0).toLocaleString()}
							</span>
						</div>
					))}
				</div>
			</div>
		);
	};

	const renderPopulationBar = (label: string, value: number, total: number, color: string) => {
		const percentage = total > 0 ? (value / total) * 100 : 0;
		
		return (
			<div className="flex items-center gap-2">
				<div className="w-16 text-[10px] font-medium text-gray-600">{label}</div>
				<div className="flex-1 flex items-center gap-2">
					<div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
						<div
							className="h-full transition-all"
							style={{
								width: `${percentage}%`,
								backgroundColor: color,
							}}
						/>
					</div>
					<div className="w-14 text-[10px] font-bold text-right">
						{value.toLocaleString()}
					</div>
				</div>
			</div>
		);
	};

	const renderPopulationSection = () => {
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
					<div className="text-xs font-bold text-gray-700 mb-2">Population Overview</div>
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
							const maleCount = ageGroups.males[ageGroup] || 0;
							const femaleCount = ageGroups.females[ageGroup] || 0;
							const malePercentage = totalCount > 0 ? (maleCount / totalCount) * 100 : 0;
							const femalePercentage = totalCount > 0 ? (femaleCount / totalCount) * 100 : 0;

							return (
								<div key={ageGroup}>
									<div className="text-[9px] text-gray-500 mb-0.5">{ageGroup}</div>
									<div className="flex h-3 rounded overflow-hidden bg-gray-200">
										<div
											className="bg-indigo-500"
											style={{ width: `${malePercentage}%` }}
											title={`Males: ${maleCount.toLocaleString()}`}
										/>
										<div
											className="bg-pink-500"
											style={{ width: `${femalePercentage}%` }}
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
			</div>
		);
	};

	const renderYearBar = (year: string, data: ChartData | undefined, dataset: Dataset | undefined, isActive: boolean) => {
		if (!dataset) return null;

		const yearColors: Record<string, { bg: string; border: string; badge: string; text: string }> = {
			'2024': { bg: 'bg-blue-50', border: 'border-blue-300', badge: 'bg-blue-300 text-blue-900', text: 'bg-blue-200 text-blue-800' },
			'2023': { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-300 text-amber-900', text: 'bg-amber-200 text-amber-800' },
			'2022': { bg: 'bg-purple-50', border: 'border-purple-300', badge: 'bg-purple-300 text-purple-900', text: 'bg-purple-200 text-purple-800' },
			'2021': { bg: 'bg-emerald-50', border: 'border-emerald-300', badge: 'bg-emerald-300 text-emerald-900', text: 'bg-emerald-200 text-emerald-800' },
		};

		const colors = yearColors[year] || yearColors['2024'];

		return (
			<div
				key={year}
				className={`p-2 rounded transition-all cursor-pointer ${isActive
					? `${colors.bg} border-2 ${colors.border}`
					: `bg-gray-50 border-2 border-gray-200 hover:${colors.border.replace('border-', 'hover:border-')}`
					}`}
				onClick={() => onDatasetChange(year)}
			>
				<div className="flex items-center justify-between mb-1.5">
					<h3 className="text-xs font-bold">{year} Elections</h3>
					{isActive && (
						<span className={`text-[9px] ${colors.badge} px-1.5 py-0.5 rounded font-semibold`}>
							ACTIVE
						</span>
					)}
				</div>
				{renderCompactBar(data, dataset)}
			</div>
		);
	};

	return (
		<div className="pointer-events-auto p-[10px] flex flex-col h-full w-[320px]">
			<div className="bg-[rgba(255,255,255,0.6)] rounded-md backdrop-blur-md shadow-lg h-[100%] p-3 flex flex-col overflow-y-auto">
				{/* Header */}
				<div className="min-h-[45px] pb-2 border-b border-gray-200">
					<h2 className="font-semibold text-sm">{title}</h2>
					{wardCode && <div className="text-gray-500 text-xs">{wardCode}</div>}
				</div>

				{/* Dataset Comparison */}
				<div className="space-y-2 flex-1 overflow-y-auto">
					{/* Election Results Section */}
					<div className="space-y-2">
						<h3 className="text-xs font-bold text-gray-700 pt-2">Election Results</h3>
						{renderYearBar('2024', chartData2024, dataset2024, activeDataset.id === '2024')}
						{renderYearBar('2023', chartData2023, dataset2023, activeDataset.id === '2023')}
						{renderYearBar('2022', chartData2022, dataset2022, activeDataset.id === '2022')}
						{renderYearBar('2021', chartData2021, dataset2021, activeDataset.id === '2021')}
					</div>

					{/* Population Section */}
					<div className="pt-3 border-t border-gray-200">
						<h3 className="text-xs font-bold text-gray-700 mb-2">Population (Mid-2020)</h3>
						{renderPopulationSection()}
					</div>
				</div>

				{/* Footer */}
				<div className="text-[9px] text-gray-400 pt-2 border-t border-gray-200 mt-auto">
					Click to switch which dataset shows on map
				</div>
			</div>
		</div>
	);
};