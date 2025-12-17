// components/LocalElectionResultChart.tsx
"use client";

import { useMemo } from "react";
import { PARTIES } from "@/lib/data/election/parties";
import { calculateTurnout } from "@/lib/utils/generalElection";
import {
	ActiveViz,
	AggregatedLocalElectionData,
	Dataset,
	LOCAL_ELECTION_YEARS,
	LocalElectionDataset,
	PartyVotes,
	SelectedArea,
} from "@lib/types";
import LocalElectionResultChart from "./LocalElectionResultChart";

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

const useLocalElectionData = (
	availableDatasets: Record<string, LocalElectionDataset>,
	aggregatedData: AggregatedLocalElectionData | null,
	selectedArea: SelectedArea | null,
	getCodeForYear?: (
		type: "ward",
		code: string,
		targetYear: number
	) => string | undefined
) => {
	return useMemo(() => {
		return LOCAL_ELECTION_YEARS.map((year): ProcessedYearData => {
			const dataset = availableDatasets[year];

			if (!dataset) {
				return {
					year,
					dataset: null,
					partyData: [],
					totalVotes: 0,
					turnout: null,
					hasData: false,
				};
			}

			let rawPartyVotes: PartyVotes | null = null;
			let turnout: number | null = null;

			// Determine Data Source (Ward vs Aggregated)
			if (selectedArea && selectedArea.type === "ward") {
				// Try to find the ward data for this year
				const wardCode = selectedArea.code;
				let data = dataset.data[wardCode];

				// If no data found and we have a code mapper, try to find the equivalent code for this year
				if (!data && getCodeForYear) {
					const mappedCode = getCodeForYear("ward", wardCode, year);
					if (mappedCode) {
						data = dataset.data[mappedCode];
					}
				}

				if (data) {
					rawPartyVotes = data.partyVotes;
					turnout = data.turnoutPercent;
				}
			} else if (selectedArea === null && aggregatedData?.[year]) {
				const agg = aggregatedData[year];
				if (agg) {
					rawPartyVotes = agg.partyVotes;
					turnout = calculateTurnout(agg.totalVotes, 0, agg.electorate);
				}
			}

			if (!rawPartyVotes) {
				return {
					year,
					dataset,
					partyData: [],
					totalVotes: 0,
					turnout: null,
					hasData: false,
				};
			}

			// Process Votes & Percentages
			// Sum manually to ensure we catch all specific party keys
			const totalVotes = Object.values(rawPartyVotes).reduce(
				(a, b) => (a || 0) + (b || 0),
				0
			);

			if (totalVotes === 0) {
				return {
					year,
					dataset,
					partyData: [],
					totalVotes: 0,
					turnout,
					hasData: false,
				};
			}

			const partyData = dataset.partyInfo
				.map((party) => {
					const votes = rawPartyVotes![party.key] || 0;
					return {
						key: party.key,
						name: party.name,
						color: PARTIES[party.key]?.color || "#999",
						votes,
						percentage: (votes / totalVotes) * 100,
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
				hasData: true,
			};
		});
	}, [availableDatasets, aggregatedData, selectedArea, getCodeForYear]);
};

interface LocalElectionResultChartSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, LocalElectionDataset>;
	aggregatedData: AggregatedLocalElectionData | null;
	selectedArea: SelectedArea | null;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: {
		getCodeForYear: (
			type: "ward",
			code: string,
			targetYear: number
		) => string | undefined;
	};
}

export default function LocalElectionResultChartSection({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	setActiveViz,
	codeMapper,
}: LocalElectionResultChartSectionProps) {
	const yearData = useLocalElectionData(
		availableDatasets,
		aggregatedData,
		selectedArea,
		codeMapper?.getCodeForYear
	);

	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 pt-2">
				Local Election Results
			</h3>

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
