// components/GeneralElectionResultChart.tsx
"use client";

import { useMemo } from "react";
import { PARTIES } from "@/lib/data/election/parties";
import { calculateTurnout } from "@/lib/utils/generalElection";
import {
	ActiveViz,
	AggregatedGeneralElectionData,
	Dataset,
	GENERAL_ELECTION_YEARS,
	GeneralElectionDataset,
	PartyVotes,
	SelectedArea,
} from "@lib/types";
import GeneralElectionResultChart from "./GeneralElectionResultChart";

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
	selectedArea: SelectedArea | null,
	getCodeForYear?: (
		type: "constituency",
		code: string,
		targetYear: number
	) => string | undefined
) => {
	return useMemo(() => {
		return GENERAL_ELECTION_YEARS.map((year): ProcessedYearData => {
			const dataset = availableDatasets[year];

			if (!dataset) {
				return {
					year,
					dataset: null,
					partyData: [],
					totalVotes: 0,
					turnout: null,
					isAggregated: false,
					seatsSummary: null,
					totalSeats: null,
					hasData: false,
				};
			}

			let rawPartyVotes: PartyVotes | null = null;
			let turnout: number | null = null;
			let isAggregated = false;
			let seatsSummary = null;
			let totalSeats = null;

			if (selectedArea && selectedArea.type === "constituency") {
				// Try to find the constituency data for this year
				const constituencyCode = selectedArea.code;
				let data = dataset.data?.[constituencyCode];

				// If no data found and we have a code mapper, try to find the equivalent code for this year
				if (!data && getCodeForYear) {
					const mappedCode = getCodeForYear(
						"constituency",
						constituencyCode,
						year
					);
					if (mappedCode) {
						data = dataset.data?.[mappedCode];
					}
				}

				if (data) {
					rawPartyVotes = data.partyVotes;
					turnout = calculateTurnout(
						data.validVotes,
						data.invalidVotes,
						data.electorate
					);
				}
			} else if (selectedArea === null && aggregatedData?.[year]) {
				const agg = aggregatedData[year];
				if (agg.partyVotes) {
					rawPartyVotes = agg.partyVotes as PartyVotes;
					turnout = calculateTurnout(
						agg.validVotes,
						agg.invalidVotes,
						agg.electorate
					);
					isAggregated = true;
					totalSeats = agg.totalSeats;

					// Process seats for legend immediately
					seatsSummary = Object.entries(agg.partySeats)
						.sort(([, a], [, b]) => (b as number) - (a as number))
						.map(([key, count]) => ({
							party: key,
							count: count as number,
							color: PARTIES[key]?.color || "#ccc",
						}));
				}
			}

			if (!rawPartyVotes) {
				return {
					year,
					dataset,
					partyData: [],
					totalVotes: 0,
					turnout: null,
					isAggregated: false,
					seatsSummary: null,
					totalSeats: null,
					hasData: false,
				};
			}

			// Process Votes & Percentages
			// Sum manually to ensure we catch all specific party keys defined in this dataset
			const totalVotes = Object.values(rawPartyVotes).reduce(
				(a, b) => (a || 0) + (b || 0),
				0
			);

			const partyData = dataset.partyInfo
				.map((party) => {
					const votes = rawPartyVotes![party.key] || 0;
					return {
						key: party.key,
						name: party.name,
						color: PARTIES[party.key]?.color || "#999",
						votes,
						percentage: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
					};
				})
				.filter((p) => p.percentage > 0)
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
				hasData: true,
			};
		});
	}, [availableDatasets, aggregatedData, selectedArea, getCodeForYear]);
};

interface GeneralElectionResultChartSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, GeneralElectionDataset>;
	aggregatedData: AggregatedGeneralElectionData | null;
	selectedArea: SelectedArea | null;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: {
		getCodeForYear: (
			type: "constituency",
			code: string,
			targetYear: number
		) => string | undefined;
	};
}

export default function GeneralElectionResultChartSection({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	setActiveViz,
	codeMapper,
}: GeneralElectionResultChartSectionProps) {
	const yearData = useElectionChartData(
		availableDatasets,
		aggregatedData,
		selectedArea,
		codeMapper?.getCodeForYear
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
