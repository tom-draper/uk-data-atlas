// components/GeneralElectionResultChart.tsx
'use client';
import { PARTY_COLORS } from '@/lib/data/parties';
import { GeneralElectionDataset } from '@/lib/hooks/useGeneralElectionData';
import { AggregateGeneralElectionData, ChartData } from '@lib/types';
import { useMemo } from 'react';

interface GeneralElectionResultChartProps {
	activeDataset: any;
	availableDatasets: GeneralElectionDataset[];
	onDatasetChange: (datasetId: string) => void;
	constituencyId?: string;
	aggregatedData: AggregateGeneralElectionData | null;
}

export default function GeneralElectionResultChart({
	activeDataset,
	availableDatasets,
	onDatasetChange,
	constituencyId,
	aggregatedData
}: GeneralElectionResultChartProps) {
	const dataset2024 = availableDatasets.find(d => d.id === 'general-2024');

	const { chartData2024, turnout2024, isAggregated } = useMemo(() => {
		if (!dataset2024) {
			return { 
				chartData2024: undefined, 
				turnout2024: undefined, 
				isAggregated: false 
			};
		}

		// If we have a specific constituency selected (hovering), use that constituency's data
		if (constituencyId && dataset2024.constituencyData[constituencyId]) {
			const data = dataset2024.constituencyData[constituencyId];
			
			return {
				chartData2024: {
					LAB: data.LAB || 0,
					CON: data.CON || 0,
					LD: data.LD || 0,
					GREEN: data.GREEN || 0,
					REF: data.RUK || 0,
					SNP: data.SNP || 0,
					PC: data.PC || 0,
					DUP: data.DUP || 0,
					SF: data.SF || 0,
					IND: data.OTHER || 0,
				},
				turnout2024: data.turnoutPercent,
				isAggregated: false,
			};
		}

		// No constituency selected - use aggregated data for the location
		if (aggregatedData && aggregatedData.partyVotes) {
			console.log('Using aggregated constituency data:', aggregatedData);
			return {
				chartData2024: aggregatedData.partyVotes as ChartData,
				turnout2024: undefined, // Could calculate average turnout if needed
				isAggregated: true,
			};
		}

		console.log('No aggregated data available:', { aggregatedData, constituencyId });
		return { 
			chartData2024: undefined, 
			turnout2024: undefined, 
			isAggregated: false 
		};
	}, [constituencyId, dataset2024, aggregatedData]);

	const renderCompactBar = (
		data: ChartData | undefined, 
		dataset: GeneralElectionDataset,
		isAggregated: boolean
	) => {
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
				<div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0">
					{parties.map(party => {
						const votes = data[party.key] || 0;
						const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
						
						if (percentage === 0) return null;
						
						return (
							<div
								key={party.key}
								style={{
									width: `${percentage}%`,
									backgroundColor: PARTY_COLORS[party.key],
								}}
								title={`${party.name}: ${votes.toLocaleString()} (${percentage.toFixed(1)}%)`}
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
					{parties
						.filter(party => (data[party.key] || 0) > 0)
						.map(party => (
							<div key={party.key} className="flex items-center gap-1">
								<div
									className="w-1.5 h-1.5 rounded-sm shrink-0"
									style={{ backgroundColor: PARTY_COLORS[party.key] }}
								/>
								<span className="truncate font-medium">
									{party.key}: {(data[party.key] || 0).toLocaleString()}
								</span>
							</div>
						))}
				</div>
				{/* Show seats breakdown if aggregated */}
				{isAggregated && aggregatedData && (
					<div className="mt-2 pt-2 border-t border-gray-200">
						<div className="text-[9px] font-medium text-gray-600 mb-1">
							Seats won: {aggregatedData.totalSeats}
						</div>
						<div className="grid grid-cols-3 gap-0.5 text-[9px]">
							{Object.entries(aggregatedData.partySeats)
								.sort(([, a], [, b]) => (b as number) - (a as number))
								.map(([partyKey, seats]) => (
									<div key={partyKey} className="flex items-center gap-1">
										<div
											className="w-1.5 h-1.5 rounded-sm shrink-0"
											style={{ backgroundColor: PARTY_COLORS[partyKey] }}
										/>
										<span className="truncate font-medium">
											{partyKey}: {seats}
										</span>
									</div>
								))}
						</div>
					</div>
				)}
			</div>
		);
	};

	const renderYearBar = (
		year: string,
		data: ChartData | undefined,
		dataset: GeneralElectionDataset | undefined,
		turnout: number | undefined,
		isActive: boolean,
		isAggregated: boolean
	) => {
		if (!dataset) {
			return <div className="text-xs text-gray-400 pt-3 text-center">No data available</div>;
		}

		const yearColors: Record<string, { bg: string; border: string }> = {
			'general-2024': { bg: 'bg-indigo-50/60', border: 'border-indigo-400' },
		};

		const colors = yearColors[dataset.id] || { bg: 'bg-indigo-50/60', border: 'border-indigo-400' };

		return (
			<div
				key={dataset.id}
				className={`p-2 ${isAggregated ? 'h-[140px]' : 'h-[95px]'} rounded transition-all cursor-pointer ${
					isActive
						? `${colors.bg} border-2 ${colors.border}`
						: `bg-white/60 border-2 border-gray-200/80 hover:border-indigo-300`
				}`}
				onClick={() => onDatasetChange(dataset.id)}
			>
				<div className="flex items-center justify-between mb-1.5">
					<div>
						<h3 className="text-xs font-bold">
							{year} General Election
							{isAggregated && <span className="text-gray-500 font-normal"> (Location)</span>}
						</h3>
					</div>
					<div className="flex items-center gap-1.5">
						{turnout !== undefined && (
							<span className="text-[9px] text-gray-500 font-medium">
								{turnout.toFixed(1)}% turnout
							</span>
						)}
					</div>
				</div>
				{renderCompactBar(data, dataset, isAggregated)}
			</div>
		);
	};

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-bold text-gray-700 pt-2">General Election Results</h3>
			{renderYearBar(
				'2024',
				chartData2024,
				dataset2024,
				turnout2024,
				activeDataset.id === 'general-2024',
				isAggregated
			)}
		</div>
	);
}