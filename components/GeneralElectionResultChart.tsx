// components/GeneralElectionResultChart.tsx
'use client';

import { useMemo, memo } from 'react';
import { ConstituencyYear } from '@/lib/data/boundaries/boundaries';
import { PARTIES } from '@/lib/data/election/parties';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { calculateTurnout } from '@/lib/utils/generalElection';
import { ActiveViz, AggregateGeneralElectionData, Dataset, GENERAL_ELECTION_YEARS, GeneralElectionDataset, PartyVotes } from '@lib/types';

const YEAR_STYLES: Record<number, { bg: string; border: string }> = {
	2024: { bg: 'bg-indigo-50/60', border: 'border-indigo-400' },
	2019: { bg: 'bg-blue-50/60', border: 'border-blue-400' },
	2017: { bg: 'bg-purple-50/60', border: 'border-purple-400' },
	2015: { bg: 'bg-violet-50/60', border: 'border-violet-400' },
};

interface ProcessedPartyData {
	key: string;
	name: string;
	color: string;
	votes: number;
	percentage: number;
}

interface ProcessedYearData {
	year: number;
	dataset: GeneralElectionDataset | null;
	partyData: ProcessedPartyData[];
	totalVotes: number;
	turnout: number | null;
	isAggregated: boolean;
	seatsSummary: { party: string; count: number; color: string }[] | null;
	totalSeats: number | null;
	hasData: boolean;
}

const useElectionChartData = (
	availableDatasets: Record<string, GeneralElectionDataset>,
	aggregatedData: AggregateGeneralElectionData | null,
	codeMapper: CodeMapper,
	constituencyCode?: string,
	wardCode?: string
) => {
	return useMemo(() => {
		const isConstituencyMode = !!constituencyCode;
		const isAggregatedMode = !wardCode && !constituencyCode;

		return GENERAL_ELECTION_YEARS.map((year): ProcessedYearData => {
			const dataset = availableDatasets[year];

			if (!dataset) {
				return { year, dataset: null, partyData: [], totalVotes: 0, turnout: null, isAggregated: false, seatsSummary: null, totalSeats: null, hasData: false };
			}

			let rawPartyVotes: PartyVotes | null = null;
			let turnout: number | null = null;
			let isAggregated = false;
			let seatsSummary = null;
			let totalSeats = null;

			// 2. Determine Data Source (Constituency vs Aggregated)
			if (isConstituencyMode && constituencyCode) {
				let data = dataset.constituencyData?.[constituencyCode];

				// Fallback conversion logic
				if (!data && dataset.constituencyData) {
					const convertedCode = codeMapper.convertConstituencyCode(constituencyCode, year as ConstituencyYear);
					if (convertedCode) data = dataset.constituencyData[convertedCode];
				}

				if (data) {
					rawPartyVotes = data.partyVotes;
					turnout = calculateTurnout(data.validVotes, data.invalidVotes, data.electorate);
				}
			} else if (isAggregatedMode && aggregatedData?.[year]) {
				const agg = aggregatedData[year];
				if (agg.partyVotes) {
					rawPartyVotes = agg.partyVotes as PartyVotes;
					turnout = calculateTurnout(agg.validVotes, agg.invalidVotes, agg.electorate);
					isAggregated = true;
					totalSeats = agg.totalSeats;

					// Process seats for legend immediately
					seatsSummary = Object.entries(agg.partySeats)
						.sort(([, a], [, b]) => (b as number) - (a as number))
						.map(([key, count]) => ({
							party: key,
							count: count as number,
							color: PARTIES[key]?.color || '#ccc'
						}));
				}
			}

			if (!rawPartyVotes) {
				return { year, dataset, partyData: [], totalVotes: 0, turnout: null, isAggregated: false, seatsSummary: null, totalSeats: null, hasData: false };
			}

			// 3. Process Votes & Percentages
			// Sum manually to ensure we catch all specific party keys defined in this dataset
			const totalVotes = Object.values(rawPartyVotes).reduce((a, b) => (a || 0) + (b || 0), 0);

			const partyData = dataset.partyInfo
				.map(party => {
					const votes = rawPartyVotes![party.key] || 0;
					return {
						key: party.key,
						name: party.name,
						color: PARTIES[party.key]?.color || '#999',
						votes,
						percentage: totalVotes > 0 ? (votes / totalVotes) * 100 : 0
					};
				})
				.filter(p => p.percentage > 0)
				.sort((a, b) => b.votes - a.votes);

			return {
				year,
				dataset,
				partyData,
				totalVotes,
				turnout,
				isAggregated,
				seatsSummary,
				totalSeats,
				hasData: true
			};
		});
	}, [availableDatasets, aggregatedData, codeMapper, constituencyCode, wardCode]);
};

const VoteBar = memo(({ data }: { data: ProcessedPartyData[] }) => (
	<div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0 w-full">
		{data.map((p) => (
			<div
				key={p.key}
				style={{ width: `${p.percentage}%`, backgroundColor: p.color }}
				title={`${p.name}: ${p.votes.toLocaleString()} (${p.percentage.toFixed(1)}%)`}
				className="group relative hover:opacity-80 transition-opacity"
			>
				{p.percentage > 12 && (
					<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
						{p.key}
					</span>
				)}
			</div>
		))}
	</div>
));
VoteBar.displayName = 'VoteBar';

const Legend = memo(({
	partyData,
	seatsSummary,
	totalSeats
}: {
	partyData: ProcessedPartyData[],
	seatsSummary: { party: string, count: number, color: string }[] | null,
	totalSeats: number | null
}) => (
	<div className="animate-in fade-in duration-200 mt-2">
		{/* Votes Legend */}
		<div className="grid grid-cols-3 gap-0.5 text-[9px]">
			{partyData.map((p) => (
				<div key={p.key} className="flex items-center gap-1">
					<div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
					<span className="truncate font-medium">
						{p.key}: {p.votes.toLocaleString()}
					</span>
				</div>
			))}
		</div>

		{/* Seats Legend (Aggregated Only) */}
		{seatsSummary && (
			<div className="mt-2 pt-2 border-t border-gray-200">
				<div className="text-[9px] font-medium text-gray-600 mb-1">
					Seats won: {totalSeats}
				</div>
				<div className="grid grid-cols-3 gap-0.5 text-[9px]">
					{seatsSummary.map((s) => (
						<div key={s.party} className="flex items-center gap-1">
							<div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
							<span className="truncate font-medium">
								{s.party}: {s.count}
							</span>
						</div>
					))}
				</div>
			</div>
		)}
	</div>
));
Legend.displayName = 'Legend';

const ElectionYearCard = memo(({
	data,
	isActive,
	setActiveViz
}: {
	data: ProcessedYearData;
	isActive: boolean;
	setActiveViz: (val: ActiveViz) => void;
}) => {
	const colors = YEAR_STYLES[data.year] || YEAR_STYLES[2024];

	// Calculate height based on state
	// Active & Aggregated = Large | Active & Single = Medium | Inactive = Small
	const heightClass = isActive
		? (data.isAggregated ? 'h-[205px]' : 'h-[95px]')
		: 'h-[65px]';

	const handleActivate = () => {
		if (data.dataset) {
			setActiveViz({
				vizId: data.dataset.id,
				datasetType: data.dataset.type,
				datasetYear: data.dataset.year
			});
		}
	};

	return (
		<div
			className={`
        p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden border-2 
        ${heightClass}
        ${isActive ? `${colors.bg} ${colors.border}` : 'bg-white/60 border-gray-200/80 hover:border-indigo-300'}
      `}
			onClick={handleActivate}
		>
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">{data.year} General Election</h3>
				{data.turnout !== null && (
					<span className="text-[9px] text-gray-500 font-medium">
						{data.turnout.toFixed(1)}% turnout
					</span>
				)}
			</div>

			{/* Content Area */}
			{!data.hasData ? (
				<div className="text-xs text-gray-400/80 pt-0.5 text-center">No data available</div>
			) : (
				<div className="space-y-1">
					<VoteBar data={data.partyData} />
					{isActive && (
						<Legend
							partyData={data.partyData}
							seatsSummary={data.seatsSummary}
							totalSeats={data.totalSeats}
						/>
					)}
				</div>
			)}
		</div>
	);
});
ElectionYearCard.displayName = 'ElectionYearCard';

interface GeneralElectionResultChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, GeneralElectionDataset>;
	setActiveViz: (value: ActiveViz) => void;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregateGeneralElectionData | null;
	codeMapper: CodeMapper
}

export default function GeneralElectionResultChart({
	activeDataset,
	availableDatasets,
	setActiveViz,
	wardCode,
	constituencyCode,
	aggregatedData,
	codeMapper
}: GeneralElectionResultChartProps) {

	// Transform and memoize data once
	const yearData = useElectionChartData(
		availableDatasets,
		aggregatedData,
		codeMapper,
		constituencyCode,
		wardCode
	);

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-bold text-gray-700 pt-2">General Election Results</h3>
			{yearData.map((data) => (
				<ElectionYearCard
					key={data.year}
					data={data}
					isActive={activeDataset?.id === `general-election-${data.year}`}
					setActiveViz={setActiveViz}
				/>
			))}
		</div>
	);
}