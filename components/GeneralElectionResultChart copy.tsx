// components/LocalElectionResultChart.tsx
'use client';
import { PARTY_COLORS } from '@/lib/data/parties';
import { AllYearsAggregatedData, ChartData, Dataset } from '@lib/types';
import { useMemo } from 'react';

interface LocalElectionResultChartProps {
	activeDataset: Dataset;
	availableDatasets: Dataset[];
	onDatasetChange: (datasetId: string) => void;
	wardCode: string;
	aggregatedData: AllYearsAggregatedData;
}

export default function GeneralElectionResultChart({
	activeDataset,
	availableDatasets,
	onDatasetChange,
	wardCode,
	aggregatedData,
}: LocalElectionResultChartProps) {
	const allYearsWardData = useMemo(() => ({
		data2024: availableDatasets.find(d => d.id === '2024')?.wardData || {},
	}), [availableDatasets]);

	const { chartData2024, turnout2024 } = useMemo(() => {
		const getChartData = (yearData: any, year: string): { chartData: ChartData | undefined; turnout: number | undefined } => {
			// If we have a specific ward selected (hovering), use that ward's data
			if (wardCode && wardCode.trim() && yearData && yearData[wardCode]) {
				const data = yearData[wardCode];
				return {
					chartData: {
						LAB: (data.LAB as number) || 0,
						CON: (data.CON as number) || 0,
						LD: (data.LD as number) || 0,
						GREEN: (data.GREEN as number) || 0,
						REF: (data.REF as number) || 0,
						IND: (data.IND as number) || 0,
					},
					turnout: data.turnoutPercent
				};
			}

			// If viewing a location (no ward hovered), only show aggregated data for active year
			// Historical years don't have cached location aggregations
			if (!wardCode && aggregatedData[`data${year}` as keyof AllYearsAggregatedData]) {
				return {
					chartData: aggregatedData[`data${year}` as keyof AllYearsAggregatedData] as ChartData,
					turnout: undefined // Aggregated data doesn't include turnout
				};
			}

			return { chartData: undefined, turnout: undefined };
		};

		// Calculate data for each year independently
		const data2024 = getChartData(allYearsWardData?.data2024, '2024');

		return {
			chartData2024: data2024.chartData,
			turnout2024: data2024.turnout,
		};
	}, [wardCode, allYearsWardData, activeDataset, aggregatedData]);

	const dataset2024 = availableDatasets.find(d => d.id === '2024');

	const renderCompactBar = (data: ChartData | undefined, dataset: Dataset) => {
		if (!data) {
			return <div className="text-xs text-gray-400 pt-3 text-center">No data available</div>;
		}

		const parties = dataset.partyInfo;
		const totalVotes = parties.reduce((sum, p) => sum + (data[p.key] || 0), 0);

		if (totalVotes === 0) {
			return <div className="text-xs text-gray-400 pt-3 text-center">No votes recorded</div>;
		}

		return (
			<div className="space-y-1">
				{/* Main bar showing all parties */}
				<div className="flex h-5 rounded overflow-hidden bg-gray-200  gap-0">
					{parties.map(party => {
						const votes = data[party.key] || 0;
						const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
						return (
							<div
								key={party.key}
								style={{
									width: `${percentage}%`,
									backgroundColor: PARTY_COLORS[party.key],
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
								className="w-1.5 h-1.5 rounded-sm shrink-0"
								style={{ backgroundColor: PARTY_COLORS[party.key] }}
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

	const renderYearBar = (
		year: string,
		data: ChartData | undefined,
		dataset: Dataset | undefined,
		turnout: number | undefined,
		isActive: boolean
	) => {
		if (!dataset) {
			return null;
		}

		const yearColors: Record<string, { bg: string; border: string; badge: string; text: string }> = {
			'2024': { bg: 'bg-blue-50/60', border: 'border-blue-300', badge: 'bg-blue-300 text-blue-900', text: 'bg-blue-200 text-blue-800' },
			'2023': { bg: 'bg-amber-50/60', border: 'border-amber-300', badge: 'bg-amber-300 text-amber-900', text: 'bg-amber-200 text-amber-800' },
			'2022': { bg: 'bg-purple-50/60', border: 'border-purple-300', badge: 'bg-purple-300 text-purple-900', text: 'bg-purple-200 text-purple-800' },
			'2021': { bg: 'bg-emerald-50/60', border: 'border-emerald-300', badge: 'bg-emerald-300 text-emerald-900', text: 'bg-emerald-200 text-emerald-800' },
		};

		const colors = yearColors[year] || yearColors['2024'];

		return (
			<div
				key={year}
				className={`p-2 h-[95px] rounded transition-all cursor-pointer ${isActive
					? `${colors.bg} border-2 ${colors.border}`
					: `bg-white/60 border-2 border-gray-200/80 hover:${colors.border.replace('border-', 'hover:border-')}`
					}`}
				onClick={() => onDatasetChange(year)}
			>
				<div className="flex items-center justify-between mb-1.5">
					<h3 className="text-xs font-bold">{year} General Elections</h3>
					<div className="flex items-center gap-1.5">
						{turnout !== undefined && (
							<span className="text-[9px] text-gray-500 font-medium">
								{turnout.toFixed(1)}% turnout
							</span>
						)}
					</div>
				</div>
				{renderCompactBar(data, dataset)}
			</div>
		);
	};

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-bold text-gray-700 pt-2">General Election Results</h3>
			{renderYearBar('2024', chartData2024, dataset2024, turnout2024, activeDataset.id === '2024')}
		</div>
	);
};