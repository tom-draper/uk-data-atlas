// components/GeneralElectionResultChart.tsx
'use client';
import { ConstituencyYear } from '@/lib/data/boundaries/boundaries';
import { PARTIES } from '@/lib/data/election/parties';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { calculateTurnout } from '@/lib/utils/generalElection';
import { AggregateGeneralElectionData, Dataset, GeneralElectionDataset, PartyVotes } from '@lib/types';
import React, { useMemo, useCallback } from 'react';

interface GeneralElectionResultChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, GeneralElectionDataset>;
	setActiveDatasetId: (datasetId: string) => void;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregateGeneralElectionData | null;
	codeMapper: CodeMapper
}

const ELECTION_YEARS = [2024, 2019, 2017, 2015] as const;

interface CompactBarProps {
	data: PartyVotes | null;
	dataset: GeneralElectionDataset;
	isAggregated: boolean;
	isActive: boolean;
	aggregatedData: AggregateGeneralElectionData | null;
	year: number;
	totalVotes: number;
}

// Pre-calculate total votes helper (moved outside to avoid recreation)
const calcTotalVotes = (d: PartyVotes): number =>
	(d.LAB || 0) + (d.CON || 0) + (d.LD || 0) + (d.GREEN || 0) +
	(d.REF || 0) + (d.BRX || 0) + (d.UKIP || 0) + (d.SNP || 0) +
	(d.PC || 0) + (d.DUP || 0) + (d.SF || 0) + (d.IND || 0);

const CompactBar = React.memo(({ data, dataset, isAggregated, isActive, aggregatedData, year, totalVotes }: CompactBarProps) => {
	if (!data || !aggregatedData) {
		return <div className="text-xs text-gray-400/80 pt-0.5 text-center">No data available</div>;
	}

	if (!totalVotes) {
		return <div className="text-xs text-gray-400/80 pt-0.5 text-center">No votes recorded</div>;
	}

	const parties = dataset.partyInfo;

	// Pre-calculate party data to avoid recalculating in JSX
	const partyData = useMemo(() =>
		parties.map(party => {
			const votes = data[party.key] || 0;
			const percentage = (votes / totalVotes) * 100;
			return { party, votes, percentage };
		}).filter(p => p.percentage > 0),
		[parties, data, totalVotes]
	);

	// Pre-calculate seats data for aggregated view
	const seatsData = useMemo(() => {
		if (!isAggregated || !aggregatedData[year]) return null;

		return {
			totalSeats: aggregatedData[year].totalSeats,
			sortedSeats: Object.entries(aggregatedData[year].partySeats)
				.sort(([, a], [, b]) => (b as number) - (a as number))
		};
	}, [isAggregated, aggregatedData, year]);

	return (
		<div className="space-y-1">
			{/* Main bar showing all parties */}
			<div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0">
				{partyData.map(({ party, votes, percentage }) => (
					<div
						key={party.key}
						style={{
							width: `${percentage}%`,
							backgroundColor: PARTIES[party.key].color,
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
				))}
			</div>
			{/* Compact legend - only show when active */}
			{isActive && (
				<div className="animate-in fade-in duration-200">
					{/* Vote counts legend */}
					<div className="grid grid-cols-3 gap-0.5 text-[9px]">
						{partyData.map(({ party, votes }) => (
							<div key={party.key} className="flex items-center gap-1">
								<div
									className="w-1.5 h-1.5 rounded-sm shrink-0"
									style={{ backgroundColor: PARTIES[party.key].color }}
								/>
								<span className="truncate font-medium">
									{party.key}: {votes.toLocaleString()}
								</span>
							</div>
						))}
					</div>
					{/* Show seats breakdown if aggregated */}
					{seatsData && (
						<div className="mt-2 pt-2 border-t border-gray-200">
							<div className="text-[9px] font-medium text-gray-600 mb-1">
								Seats won: {seatsData.totalSeats}
							</div>
							<div className="grid grid-cols-3 gap-0.5 text-[9px]">
								{seatsData.sortedSeats.map(([partyKey, seats]) => (
									<div key={partyKey} className="flex items-center gap-1">
										<div
											className="w-1.5 h-1.5 rounded-sm shrink-0"
											style={{ backgroundColor: PARTIES[partyKey].color }}
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
	year: number;
	data: PartyVotes | null;
	dataset: GeneralElectionDataset;
	turnout: number | null;
	isActive: boolean;
	isAggregated: boolean;
	aggregatedData: AggregateGeneralElectionData | null;
	setActiveDatasetId: (datasetId: string) => void;
	totalVotes: number;
}

// Move year colors outside component to avoid recreating on each render
const YEAR_COLORS: Record<number, { bg: string; border: string }> = {
	2024: { bg: 'bg-indigo-50/60', border: 'border-indigo-400' },
	2019: { bg: 'bg-blue-50/60', border: 'border-blue-400' },
	2017: { bg: 'bg-purple-50/60', border: 'border-purple-400' },
	2015: { bg: 'bg-violet-50/60', border: 'border-violet-400' },
};

const YearBar = React.memo(({
	year,
	data,
	dataset,
	turnout,
	isActive,
	isAggregated,
	aggregatedData,
	setActiveDatasetId,
	totalVotes
}: YearBarProps) => {
	const colors = YEAR_COLORS[year] || { bg: 'bg-indigo-50/60', border: 'border-indigo-400' };

	const handleClick = useCallback(() => {
		setActiveDatasetId(dataset.id);
	}, [setActiveDatasetId, year]);

	// Pre-calculate height to avoid inline calculation
	const height = isActive ? (isAggregated ? '205px' : '95px') : '65px';

	return (
		<div
			className={`p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: 'bg-white/60 border-2 border-gray-200/80 hover:border-indigo-300'
				}`}
			style={{ height }}
			onClick={handleClick}
		>
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">
					{year} General Election
				</h3>
				{turnout !== null && (
					<span className="text-[9px] text-gray-500 font-medium">
						{turnout.toFixed(1)}% turnout
					</span>
				)}
			</div>
			<CompactBar
				data={data}
				dataset={dataset}
				isAggregated={isAggregated}
				isActive={isActive}
				aggregatedData={aggregatedData}
				year={year}
				totalVotes={totalVotes}
			/>
		</div>
	);
});
YearBar.displayName = 'YearBar';


// Helper to map party votes once (memoize to avoid recreating object if values are the same)
const mapPartyVotes = (partyVotes: any): PartyVotes => ({
	LAB: partyVotes.LAB || 0,
	CON: partyVotes.CON || 0,
	LD: partyVotes.LD || 0,
	GREEN: partyVotes.GREEN || 0,
	REF: partyVotes.RUK || 0,
	BRX: partyVotes.BRX || 0,
	UKIP: partyVotes.UKIP || 0,
	SNP: partyVotes.SNP || 0,
	PC: partyVotes.PC || 0,
	DUP: partyVotes.DUP || 0,
	SF: partyVotes.SF || 0,
	IND: partyVotes.OTHER || 0,
});

// Cache for constituency lookups to avoid repeated code conversions
const constituencyLookupCache = new Map<string, Map<number, any>>();

export default function GeneralElectionResultChart({
	activeDataset,
	availableDatasets,
	setActiveDatasetId,
	wardCode,
	constituencyCode,
	aggregatedData,
	codeMapper
}: GeneralElectionResultChartProps) {
	// Optimize constituency data lookup with caching
	const getConstituencyData = useCallback((year: ConstituencyYear, constituencyCode: string) => {
		const dataset = availableDatasets[`general-election-${year}`];
		if (!dataset?.constituencyData) return null;

		// Check cache first
		const cacheKey = constituencyCode;
		if (!constituencyLookupCache.has(cacheKey)) {
			constituencyLookupCache.set(cacheKey, new Map());
		}
		const yearCache = constituencyLookupCache.get(cacheKey)!;

		if (yearCache.has(year)) {
			return yearCache.get(year);
		}

		// Try direct lookup first
		let data = dataset.constituencyData[constituencyCode];

		// Fallback to conversion if needed
		if (!data) {
			const convertedCode = codeMapper.convertConstituencyCode(constituencyCode, year);
			if (convertedCode) {
				data = dataset.constituencyData[convertedCode];
			}
		}

		// Cache the result (even if null)
		yearCache.set(year, data || null);
		return data || null;
	}, [availableDatasets, codeMapper]);

	const yearDataMap = useMemo(() => {
		const map: Record<number, {
			chartData: PartyVotes | null;
			turnout: number | null;
			isAggregated: boolean;
			totalVotes: number;
		}> = {} as any;

		// Null result object (reused to avoid creating multiple identical objects)
		const nullResult = {
			chartData: null,
			turnout: null,
			isAggregated: false,
			totalVotes: 0
		};

		const isConstituencyMode = !!constituencyCode;
		const isAggregatedMode = !wardCode && !constituencyCode;

		for (const year of ELECTION_YEARS) {
			const dataset = availableDatasets[`general-election-${year}`];

			if (!dataset) {
				map[year] = nullResult;
				continue;
			}

			if (isConstituencyMode && constituencyCode) {
				const data = getConstituencyData(year, constituencyCode);

				if (data) {
					const chartData = mapPartyVotes(data.partyVotes);
					map[year] = {
						chartData,
						turnout: calculateTurnout(data.validVotes, data.invalidVotes, data.electorate),
						isAggregated: false,
						totalVotes: calcTotalVotes(chartData)
					};
					continue;
				}
			}

			if (isAggregatedMode) {
				const yearAggData = aggregatedData?.[year];
				if (yearAggData?.partyVotes) {
					const chartData = yearAggData.partyVotes as PartyVotes;
					map[year] = {
						chartData,
						turnout: calculateTurnout(yearAggData.validVotes, yearAggData.invalidVotes, yearAggData.electorate),
						isAggregated: true,
						totalVotes: calcTotalVotes(chartData)
					};
					continue;
				}
			}

			map[year] = nullResult;
		}

		return map;
	}, [constituencyCode, wardCode, availableDatasets, aggregatedData, getConstituencyData]);

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-bold text-gray-700 pt-2">General Election Results</h3>
			{ELECTION_YEARS.map(year => {
				const datasetId = `general-election-${year}`
				const dataset = availableDatasets[datasetId];
				if (!dataset) {
					return null;
				}

				const yearData = yearDataMap[year];

				return (
					<YearBar
						key={year}
						year={year}
						data={yearData.chartData}
						dataset={dataset}
						turnout={yearData.turnout}
						isActive={activeDataset?.id === datasetId}
						isAggregated={yearData.isAggregated}
						aggregatedData={aggregatedData}
						setActiveDatasetId={setActiveDatasetId}
						totalVotes={yearData.totalVotes}
					/>
				);
			})}
		</div>
	);
}