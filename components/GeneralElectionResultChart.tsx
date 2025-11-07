// components/GeneralElectionResultChart.tsx
'use client';
import { PARTY_COLORS } from '@/lib/data/parties';
import { AggregateGeneralElectionData, GeneralElectionDataset, PartyVotes } from '@lib/types';
import React, { useMemo, useCallback } from 'react';

interface GeneralElectionResultChartProps {
	activeDataset: any;
	availableDatasets: Record<string, GeneralElectionDataset | null>;
	setActiveDatasetId: (datasetId: string) => void;
	constituencyCode?: string;
	aggregatedData: AggregateGeneralElectionData | null;
}

interface CompactBarProps {
	data: PartyVotes | undefined;
	dataset: GeneralElectionDataset;
	isAggregated: boolean;
	isActive: boolean;
	aggregatedData: AggregateGeneralElectionData | null;
}

const CompactBar = React.memo(({ data, dataset, isAggregated, isActive, aggregatedData }: CompactBarProps) => {
	if (!data || !aggregatedData) {
		return <div className="text-xs text-gray-400/80 pt-1 text-center">No data available</div>;
	}

	const parties = dataset.partyInfo;
	const totalVotes = parties.reduce((sum, p) => sum + (data[p.key] || 0), 0);

	if (totalVotes === 0) {
		return <div className="text-xs text-gray-400/80 pt-1 text-center">No votes recorded</div>;
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
			{/* Compact legend - only show when active */}
			{isActive && (
				<div className="animate-in fade-in duration-200">
					{/* Vote counts legend */}
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
								Seats won: {aggregatedData[2024].totalSeats}
							</div>
							<div className="grid grid-cols-3 gap-0.5 text-[9px]">
								{Object.entries(aggregatedData[2024].partySeats)
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
			)}
		</div>
	);
});
CompactBar.displayName = 'CompactBar';

interface YearBarProps {
	year: string;
	data: PartyVotes | undefined;
	dataset: GeneralElectionDataset;
	turnout: number | undefined;
	isActive: boolean;
	isAggregated: boolean;
	aggregatedData: AggregateGeneralElectionData | null;
	setActiveDatasetId: (datasetId: string) => void;
}

const YearBar = React.memo(({ 
	year, 
	data, 
	dataset, 
	turnout, 
	isActive, 
	isAggregated,
	aggregatedData,
	setActiveDatasetId 
}: YearBarProps) => {
	const yearColors: Record<string, { bg: string; border: string }> = {
		'general-2024': { bg: 'bg-indigo-50/60', border: 'border-indigo-400' },
	};

	const colors = yearColors[dataset.id] || { bg: 'bg-indigo-50/60', border: 'border-indigo-400' };

	const handleClick = useCallback(() => {
		setActiveDatasetId('general-' + year);
	}, [setActiveDatasetId, year]);

	return (
		<div
			className={`p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden ${
				isActive
					? `${colors.bg} border-2 ${colors.border}`
					: `bg-white/60 border-2 border-gray-200/80 hover:border-indigo-300`
			}`}
			style={{
				height: isActive && isAggregated ? '205px' : isActive ? '95px' : '65px'
			}}
			onClick={handleClick}
		>
			<div className="flex items-center justify-between mb-1.5">
				<div>
					<h3 className="text-xs font-bold">
						{year} General Election
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
			<CompactBar 
				data={data} 
				dataset={dataset} 
				isAggregated={isAggregated} 
				isActive={isActive}
				aggregatedData={aggregatedData}
			/>
		</div>
	);
});
YearBar.displayName = 'YearBar';

export default function GeneralElectionResultChart({
	activeDataset,
	availableDatasets,
	setActiveDatasetId,
	constituencyCode,
	aggregatedData
}: GeneralElectionResultChartProps) {
	const dataset2024 = availableDatasets['general-2024'];

	const { chartData2024, turnout2024, isAggregated } = useMemo(() => {
		if (!dataset2024 || !aggregatedData) {
			return {
				chartData2024: undefined,
				turnout2024: undefined,
				isAggregated: false
			};
		}

		// If we have a specific constituency selected (hovering), use that constituency's data
		if (constituencyCode && dataset2024.constituencyData[constituencyCode]) {
			const data = dataset2024.constituencyData[constituencyCode];

			return {
				chartData2024: {
					LAB: data.partyVotes.LAB || 0,
					CON: data.partyVotes.CON || 0,
					LD: data.partyVotes.LD || 0,
					GREEN: data.partyVotes.GREEN || 0,
					REF: data.partyVotes.RUK || 0,
					SNP: data.partyVotes.SNP || 0,
					PC: data.partyVotes.PC || 0,
					DUP: data.partyVotes.DUP || 0,
					SF: data.partyVotes.SF || 0,
					IND: data.partyVotes.OTHER || 0,
				},
				turnout2024: data.turnoutPercent,
				isAggregated: false,
			};
		}

		// No constituency selected - use aggregated data for the location
		if (aggregatedData && aggregatedData[2024].partyVotes) {
			return {
				chartData2024: aggregatedData[2024].partyVotes as PartyVotes,
				turnout2024: undefined, // Could calculate average turnout if needed
				isAggregated: true,
			};
		}

		return {
			chartData2024: undefined,
			turnout2024: undefined,
			isAggregated: false
		};
	}, [constituencyCode, dataset2024, aggregatedData]);

	if (!dataset2024) {
		return null;
	}

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-bold text-gray-700 pt-2">General Election Results</h3>
			<YearBar
				year="2024"
				data={chartData2024}
				dataset={dataset2024}
				turnout={turnout2024}
				isActive={activeDataset.id === 'general-2024'}
				isAggregated={isAggregated}
				aggregatedData={aggregatedData}
				setActiveDatasetId={setActiveDatasetId}
			/>
		</div>
	);
}