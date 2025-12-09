// components/GeneralElectionResultChart.tsx
'use client';

import { useMemo } from 'react';
import { ConstituencyYear } from '@/lib/data/boundaries/boundaries';
import { PARTIES } from '@/lib/data/election/parties';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { calculateTurnout } from '@/lib/utils/generalElection';
import { ActiveViz, AggregatedGeneralElectionData, Dataset, GENERAL_ELECTION_YEARS, GeneralElectionDataset, PartyVotes } from '@lib/types';
import GeneralElectionResultChart from './GeneralElectionResultChart';

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
	aggregatedData: AggregatedGeneralElectionData | null,
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

			// Determine Data Source (Constituency vs Aggregated)
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

			// Process Votes & Percentages
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

interface GeneralElectionResultChartSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, GeneralElectionDataset>;
	setActiveViz: (value: ActiveViz) => void;
	wardCode?: string;
	constituencyCode?: string;
	aggregatedData: AggregatedGeneralElectionData | null;
	codeMapper: CodeMapper
}

export default function GeneralElectionResultChartSection({
	activeDataset,
	availableDatasets,
	setActiveViz,
	wardCode,
	constituencyCode,
	aggregatedData,
	codeMapper
}: GeneralElectionResultChartSectionProps) {
	const yearData = useElectionChartData(
		availableDatasets,
		aggregatedData,
		codeMapper,
		constituencyCode,
		wardCode
	);

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-bold pt-2">General Election Results</h3>
			{yearData.map((data) => (
				<GeneralElectionResultChart
					key={data.year}
					data={data}
					isActive={activeDataset?.id === `generalElection-${data.year}`}
					setActiveViz={setActiveViz}
				/>
			))}
		</div>
	);
}