// components/LocalElectionResultChart.tsx
'use client';
import { WardYear } from '@/lib/data/boundaries/boundaries';
import { PARTIES } from '@/lib/data/election/parties';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { calculateTurnout } from '@/lib/utils/generalElection';
import { AggregatedLocalElectionData, PartyVotes, Dataset, LocalElectionDataset } from '@lib/types';
import React, { useMemo, useCallback } from 'react';

interface LocalElectionResultChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, LocalElectionDataset>;
	setActiveDatasetId: (datasetId: string) => void;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregatedLocalElectionData | null;
	codeMapper: CodeMapper
}

const ELECTION_YEARS = [2024, 2023, 2022, 2021] as const;

interface CompactBarProps {
	data: PartyVotes | null;
	dataset: LocalElectionDataset;
	isActive: boolean;
	totalVotes: number;
}

const CompactBar = React.memo(({ data, dataset, isActive, totalVotes }: CompactBarProps) => {
	if (!data) {
		return <div className="text-xs text-gray-400/80 pt-0.5 text-center">No data available</div>;
	}

	if (totalVotes === 0) {
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
						title={`${party.name}: ${votes.toLocaleString()}`}
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
				</div>
			)}
		</div>
	);
});
CompactBar.displayName = 'CompactBar';

interface YearBarProps {
	year: number;
	data: PartyVotes | null;
	dataset: LocalElectionDataset;
	turnout: number | null;
	isActive: boolean;
	setActiveDatasetId: (datasetId: string) => void;
	totalVotes: number;
}

// Move year colors outside component to avoid recreating on each render
const YEAR_COLORS: Record<string, { bg: string; border: string; badge: string; text: string }> = {
	'2024': { bg: 'bg-blue-50/60', border: 'border-blue-300', badge: 'bg-blue-300 text-blue-900', text: 'bg-blue-200 text-blue-800' },
	'2023': { bg: 'bg-amber-50/60', border: 'border-amber-300', badge: 'bg-amber-300 text-amber-900', text: 'bg-amber-200 text-amber-800' },
	'2022': { bg: 'bg-purple-50/60', border: 'border-purple-300', badge: 'bg-purple-300 text-purple-900', text: 'bg-purple-200 text-purple-800' },
	'2021': { bg: 'bg-emerald-50/60', border: 'border-emerald-300', badge: 'bg-emerald-300 text-emerald-900', text: 'bg-emerald-200 text-emerald-800' },
};

const YearBar = React.memo(({ year, data, dataset, turnout, isActive, setActiveDatasetId, totalVotes }: YearBarProps) => {
	const colors = YEAR_COLORS[year] || YEAR_COLORS['2024'];

	const handleClick = useCallback(() => {
		setActiveDatasetId(dataset.id);
	}, [setActiveDatasetId, year]);

	// Pre-calculate height to avoid inline calculation
	const height = isActive && data ? '95px' : '65px';

	return (
		<div
			className={`p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: 'bg-white/60 border-2 border-gray-200/80 hover:border-blue-300'
				}`}
			style={{ height }}
			onClick={handleClick}
		>
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">{dataset.name}</h3>
				{turnout && (
					<span className="text-[9px] text-gray-500 font-medium">
						{turnout.toFixed(1)}% turnout
					</span>
				)}
			</div>
			<CompactBar data={data} dataset={dataset} isActive={isActive} totalVotes={totalVotes} />
		</div>
	);
});
YearBar.displayName = 'YearBar';

// Helper function to calculate total votes (moved outside to avoid recreation)
const calcTotalVotes = (d: PartyVotes): number =>
	(d.LAB || 0) + (d.CON || 0) + (d.LD || 0) + (d.GREEN || 0) +
	(d.REF || 0) + (d.IND || 0) + (d.DUP || 0) + (d.PC || 0) +
	(d.SNP || 0) + (d.SF || 0) + (d.APNI || 0) + (d.SDLP || 0);

// Helper function to map party votes efficiently
const mapPartyVotes = (partyVotes: any): PartyVotes => ({
	LAB: partyVotes.LAB || 0,
	CON: partyVotes.CON || 0,
	LD: partyVotes.LD || 0,
	GREEN: partyVotes.GREEN || 0,
	REF: partyVotes.REF || 0,
	IND: partyVotes.IND || 0,
	DUP: partyVotes.DUP || 0,
	PC: partyVotes.PC || 0,
	SNP: partyVotes.SNP || 0,
	SF: partyVotes.SF || 0,
	APNI: partyVotes.APNI || 0,
	SDLP: partyVotes.SDLP || 0,
});

// Cache for ward lookups to avoid repeated code conversions
const wardLookupCache = new Map<string, Map<number, any>>();

export default function LocalElectionResultChart({
	activeDataset,
	availableDatasets,
	setActiveDatasetId,
	wardCode,
	constituencyCode,
	aggregatedData,
	codeMapper
}: LocalElectionResultChartProps) {
	// Optimize ward data lookup with caching
	const getWardData = useCallback((year: WardYear, wardCode: string) => {
		const dataset = availableDatasets[`local-election-${year}`];
		if (!dataset?.wardData) return null;

		// Check cache first
		const cacheKey = wardCode;
		if (!wardLookupCache.has(cacheKey)) {
			wardLookupCache.set(cacheKey, new Map());
		}
		const yearCache = wardLookupCache.get(cacheKey)!;

		if (yearCache.has(year)) {
			return yearCache.get(year);
		}

		// Try direct lookup first
		let data = dataset.wardData[wardCode];

		// Fallback to conversion if needed
		if (!data) {
			const convertedCode = codeMapper.convertWardCode(wardCode, year);
			if (convertedCode) {
				data = dataset.wardData[convertedCode];
			}
		}

		// Cache the result (even if null)
		yearCache.set(year, data || null);
		return data || null;
	}, [availableDatasets, codeMapper]);

	const yearDataMap = useMemo(() => {
		const map: Record<string, {
			chartData: PartyVotes | null;
			turnout: number | null;
			totalVotes: number;
		}> = {};

		// Null result object (reused to avoid creating multiple identical objects)
		const nullResult = {
			chartData: null,
			turnout: null,
			totalVotes: 0
		};

		// Check mode once outside loop
		const isWardMode = !!wardCode;
		const isAggregatedMode = !wardCode && !constituencyCode;

		for (const year of ELECTION_YEARS) {
			const dataset = availableDatasets[`local-election-${year}`];

			if (!dataset) {
				map[year] = nullResult;
				continue;
			}

			if (isWardMode && wardCode) {
				const data = getWardData(year, wardCode);

				if (data) {
					const chartData = mapPartyVotes(data.partyVotes);
					map[year] = {
						chartData,
						turnout: data.turnoutPercent,
						totalVotes: calcTotalVotes(chartData)
					};
					continue;
				}
			}

			// Fallback to aggregated data
			if (isAggregatedMode) {
				const yearAggData = aggregatedData?.[year];
				if (yearAggData) {
					const chartData = yearAggData.partyVotes;
					map[year] = {
						chartData,
						turnout: calculateTurnout(yearAggData.totalVotes, 0, yearAggData.electorate),
						totalVotes: calcTotalVotes(chartData)
					};
					continue;
				}
			}

			// No data found
			map[year] = nullResult;
		}

		return map;
	}, [wardCode, constituencyCode, availableDatasets, aggregatedData, getWardData]);

	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 pt-2">Local Election Results</h3>

			{ELECTION_YEARS.map(year => {
				const datasetId = `local-election-${year}`
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
						setActiveDatasetId={setActiveDatasetId}
						totalVotes={yearData.totalVotes}
					/>
				);
			})}
		</div>
	);
};