// components/LocalElectionResultChart.tsx
'use client';

import { useMemo } from 'react';
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
import LocalElectionResultChart from './LocalElectionResultChart';

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

			if (!dataset) {
				return { year, dataset: null, partyData: [], totalVotes: 0, turnout: null, hasData: false };
			}

			let rawPartyVotes: PartyVotes | null = null;
			let turnout: number | null = null;

			// Determine Data Source (Ward vs Aggregated)
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

			// Process Votes & Percentages
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

interface LocalElectionResultChartSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, LocalElectionDataset>;
	setActiveViz: (value: ActiveViz) => void;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregatedLocalElectionData | null;
	codeMapper: CodeMapper
}

export default function LocalElectionResultChartSection({
	activeDataset,
	availableDatasets,
	setActiveViz,
	wardCode,
	constituencyCode,
	aggregatedData,
	codeMapper
}: LocalElectionResultChartSectionProps) {
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
				<LocalElectionResultChart
					key={data.year}
					data={data}
					isActive={activeDataset?.id === `localElection${data.year}`}
					setActiveViz={setActiveViz}
				/>
			))}
		</div>
	);
}