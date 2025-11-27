// components/LocalElectionResultChart.tsx
'use client';

import { useMemo, memo } from 'react';
import { WardYear } from '@/lib/data/boundaries/boundaries';
import { PARTIES } from '@/lib/data/election/parties';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { calculateTurnout } from '@/lib/utils/generalElection';
import {
	AggregatedLocalElectionData,
	PartyVotes,
	Dataset,
	LocalElectionDataset,
	ActiveViz,
	LOCAL_ELECTION_YEARS
} from '@lib/types';

const YEAR_STYLES: Record<string, { bg: string; border: string }> = {
	'2024': { bg: 'bg-blue-50/60', border: 'border-blue-300' },
	'2023': { bg: 'bg-amber-50/60', border: 'border-amber-300' },
	'2022': { bg: 'bg-purple-50/60', border: 'border-purple-300' },
	'2021': { bg: 'bg-emerald-50/60', border: 'border-emerald-300' },
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
	dataset: LocalElectionDataset | null;
	partyData: ProcessedPartyData[];
	totalVotes: number;
	turnout: number | null;
	hasData: boolean;
}

// --- Helper Hook for Data Transformation ---

const useLocalElectionData = (
	availableDatasets: Record<string, LocalElectionDataset>,
	aggregatedData: AggregatedLocalElectionData | null,
	codeMapper: CodeMapper,
	wardCode?: string,
	constituencyCode?: string
) => {
	return useMemo(() => {
		const isWardMode = !!wardCode;
		const isAggregatedMode = !wardCode && !constituencyCode;

		return LOCAL_ELECTION_YEARS.map((year): ProcessedYearData => {
			const dataset = availableDatasets[year];

			// 1. Early return if no dataset
			if (!dataset) {
				return { year, dataset: null, partyData: [], totalVotes: 0, turnout: null, hasData: false };
			}

			let rawPartyVotes: PartyVotes | null = null;
			let turnout: number | null = null;

			// 2. Determine Data Source (Ward vs Aggregated)
			if (isWardMode && wardCode && dataset.wardData) {
				let data = dataset.wardData[wardCode];

				// Fallback conversion logic (e.g., old ward codes)
				if (!data) {
					const convertedCode = codeMapper.convertWardCode(wardCode, year as WardYear);
					if (convertedCode) data = dataset.wardData[convertedCode];
				}

				if (data) {
					rawPartyVotes = data.partyVotes;
					turnout = data.turnoutPercent;
				}
			} else if (isAggregatedMode && aggregatedData?.[year]) {
				const agg = aggregatedData[year];
				if (agg) {
					rawPartyVotes = agg.partyVotes;
					turnout = calculateTurnout(agg.totalVotes, 0, agg.electorate);
				}
			}

			if (!rawPartyVotes) {
				return { year, dataset, partyData: [], totalVotes: 0, turnout: null, hasData: false };
			}

			// 3. Process Votes & Percentages
			// Sum manually to ensure we catch all specific party keys
			const totalVotes = Object.values(rawPartyVotes).reduce((a, b) => (a || 0) + (b || 0), 0);

			if (totalVotes === 0) {
				return { year, dataset, partyData: [], totalVotes: 0, turnout, hasData: false };
			}

			const partyData = dataset.partyInfo
				.map(party => {
					const votes = rawPartyVotes![party.key] || 0;
					return {
						key: party.key,
						name: party.name,
						color: PARTIES[party.key]?.color || '#999',
						votes,
						percentage: (votes / totalVotes) * 100
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
				hasData: true
			};
		});
	}, [availableDatasets, aggregatedData, codeMapper, wardCode, constituencyCode]);
};

// --- Sub-Components ---

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

const Legend = memo(({ partyData }: { partyData: ProcessedPartyData[] }) => (
	<div className="animate-in fade-in duration-200 mt-1">
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
	const colors = YEAR_STYLES[data.year] || YEAR_STYLES['2024'];

	// Active = Medium Height | Inactive = Small Height
	const heightClass = isActive ? 'h-[95px]' : 'h-[65px]';

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
        ${isActive ? `${colors.bg} ${colors.border}` : 'bg-white/60 border-gray-200/80 hover:border-blue-300'}
      `}
			onClick={handleActivate}
		>
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">{data.year} Local Elections</h3>
				{data.turnout && (
					<span className="text-[9px] text-gray-500 font-medium">
						{data.turnout.toFixed(1)}% turnout
					</span>
				)}
			</div>

			{!data.hasData ? (
				<div className="text-xs text-gray-400/80 pt-0.5 text-center">No data available</div>
			) : (
				<div className="space-y-1">
					<VoteBar data={data.partyData} />
					{isActive && <Legend partyData={data.partyData} />}
				</div>
			)}
		</div>
	);
});
ElectionYearCard.displayName = 'ElectionYearCard';

// --- Main Component ---

interface LocalElectionResultChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, LocalElectionDataset>;
	setActiveViz: (value: ActiveViz) => void;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregatedLocalElectionData | null;
	codeMapper: CodeMapper
}

export default function LocalElectionResultChart({
	activeDataset,
	availableDatasets,
	setActiveViz,
	wardCode,
	constituencyCode,
	aggregatedData,
	codeMapper
}: LocalElectionResultChartProps) {

	// Transform and memoize data once
	const yearData = useLocalElectionData(
		availableDatasets,
		aggregatedData,
		codeMapper,
		wardCode,
		constituencyCode
	);

	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 pt-2">Local Election Results</h3>

			{yearData.map((data) => (
				<ElectionYearCard
					key={data.year}
					data={data}
					isActive={activeDataset?.id === `localElection${data.year}`}
					setActiveViz={setActiveViz}
				/>
			))}
		</div>
	);
}