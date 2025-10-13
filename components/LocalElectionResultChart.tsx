// components/LocalElectionResultChart.tsx
'use client';
import { ChartData, Dataset } from '@/lib/types';
import { useMemo } from 'react';

interface LocalElectionResultChartProps {
	activeDataset: Dataset;
	availableDatasets: Dataset[];
	onDatasetChange: (datasetId: string) => void;
	wardCode: string; // The currently hovered ward code
	wardData: any; // The ref object containing all years' data
	aggregatedData: ChartData | null; // Data for an entire location (e.g., Manchester)
}

export const LocalElectionResultChart = ({
	activeDataset,
	availableDatasets,
	onDatasetChange,
	wardCode,
	wardData,
	aggregatedData,
}: LocalElectionResultChartProps) => {

	// Calculate the chart data for all years based on the current context (ward or location)
	const { chartData2024, chartData2023, chartData2022, chartData2021 } = useMemo(() => {
		const getChartData = (yearData: any): ChartData => {
			// If aggregated data is provided (location selected), use it for all charts
			if (aggregatedData) {
				return aggregatedData;
			}
			// If a specific ward is hovered, look up its data for the given year
			if (wardCode && yearData && yearData[wardCode]) {
				const data = yearData[wardCode];
				return {
					LAB: (data.LAB as number) || 0,
					CON: (data.CON as number) || 0,
					LD: (data.LD as number) || 0,
					GREEN: (data.GREEN as number) || 0,
					REF: (data.REF as number) || 0,
					IND: (data.IND as number) || 0,
				};
			}
			// Default to zero if no data
			return { LAB: 0, CON: 0, LD: 0, GREEN: 0, REF: 0, IND: 0 };
		};

		return {
			chartData2024: getChartData(wardData.data2024),
			chartData2023: getChartData(wardData.data2023),
			chartData2022: getChartData(wardData.data2022),
			chartData2021: getChartData(wardData.data2021),
		};
	}, [wardCode, wardData, aggregatedData]);

	const dataset2024 = availableDatasets.find(d => d.id === '2024');
	const dataset2023 = availableDatasets.find(d => d.id === '2023');
	const dataset2022 = availableDatasets.find(d => d.id === '2022');
	const dataset2021 = availableDatasets.find(d => d.id === '2021');

	// ... (The rest of the component's rendering logic remains the same)
	// renderCompactBar and renderYearBar functions do not need to change.
	const renderCompactBar = (data: ChartData | undefined, dataset: Dataset) => {
		if (!data) {
			return <div className="text-xs text-gray-400 py-2">No data</div>;
		}

		const parties = dataset.partyInfo;
		const totalVotes = parties.reduce((sum, p) => sum + (data[p.key] || 0), 0);

		if (totalVotes === 0) {
			return <div className="text-xs text-gray-400 py-2">No data</div>;
		}

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
		<div className="space-y-2">
			<h3 className="text-xs font-bold text-gray-700 pt-2">Election Results</h3>
			{renderYearBar('2024', chartData2024, dataset2024, activeDataset.id === '2024')}
			{renderYearBar('2023', chartData2023, dataset2023, activeDataset.id === '2023')}
			{renderYearBar('2022', chartData2022, dataset2022, activeDataset.id === '2022')}
			{renderYearBar('2021', chartData2021, dataset2021, activeDataset.id === '2021')}
		</div>
	);
};