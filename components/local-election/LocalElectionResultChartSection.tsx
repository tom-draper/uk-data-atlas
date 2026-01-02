// components/LocalElectionResultChart.tsx
"use client";

import { useMemo } from "react";
import { PARTIES } from "@/lib/data/election/parties";
import { calculateTurnout } from "@/lib/helpers/generalElection";
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
	aggregatedData: Record<number, AggregatedLocalElectionData> | null,
	selectedArea: SelectedArea | null,
	getCodeForYear?: (
		type: "ward",
		code: string,
		targetYear: number,
	) => string | undefined,
	getWardsForLad?: (ladCode: string, year: number) => string[],
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

			// Handle Ward Selection
			if (selectedArea && selectedArea.type === "ward") {
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
			} else if (selectedArea && selectedArea.type === "localAuthority" && getWardsForLad) {
				const ladCode = selectedArea.code;
				const wardCodes = getWardsForLad(ladCode, 2022);

				if (wardCodes.length > 0) {
					const aggregatedVotes: Record<string, number> = {};
					let totalElectorate = 0;
					let totalVotesAcrossWards = 0;

					// Aggregate votes across all wards in the LAD
					for (const wardCode of wardCodes) {
						let wardData = dataset.data[wardCode];

						// Try to map to the dataset's year if ward code doesn't exist
						if (!wardData && getCodeForYear) {
							const mappedCode = getCodeForYear("ward", wardCode, year);
							if (mappedCode) {
								wardData = dataset.data[mappedCode];
							}
						}

						if (wardData?.partyVotes) {
							// Aggregate party votes
							for (const [partyKey, votes] of Object.entries(wardData.partyVotes)) {
								aggregatedVotes[partyKey] = (aggregatedVotes[partyKey] || 0) + (votes || 0);
							}

							// Aggregate electorate for turnout calculation
							if (wardData.electorate) {
								totalElectorate += wardData.electorate;
							}
						}
					}

					// Calculate total votes from aggregated votes
					totalVotesAcrossWards = Object.values(aggregatedVotes).reduce((sum, votes) => sum + (votes || 0), 0);

					if (totalVotesAcrossWards > 0) {
						rawPartyVotes = aggregatedVotes as PartyVotes;
						// Calculate turnout from aggregated data
						if (totalElectorate > 0) {
							turnout = calculateTurnout(totalVotesAcrossWards, 0, totalElectorate);
						}
					}
				}
			} else if (selectedArea === null && aggregatedData?.[year]) {
				const agg = aggregatedData[year];
				if (agg) {
					rawPartyVotes = agg.partyVotes;
					turnout = calculateTurnout(
						agg.totalVotes,
						0,
						agg.electorate,
					);
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
			const totalVotes = Object.values(rawPartyVotes).reduce((a, b) => (a || 0) + (b || 0), 0);

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
	}, [availableDatasets, aggregatedData, selectedArea, getCodeForYear, getWardsForLad]);
};

interface LocalElectionResultChartSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, LocalElectionDataset>;
	aggregatedData: Record<number, AggregatedLocalElectionData> | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: {
		getCodeForYear: (
			type: "ward",
			code: string,
			targetYear: number,
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
}

export default function LocalElectionResultChartSection({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	activeViz,
	setActiveViz,
	codeMapper,
}: LocalElectionResultChartSectionProps) {
	const yearData = useLocalElectionData(
		availableDatasets,
		aggregatedData,
		selectedArea,
		codeMapper?.getCodeForYear,
		codeMapper?.getWardsForLad,
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
					isActive={
						(activeDataset &&
							((activeDataset.type === "localElection" &&
								activeDataset.id === `localElection${data.year}`) ||
								(activeViz.datasetType === "custom" && activeViz.vizId === "custom"))) as boolean
					}
					setActiveViz={setActiveViz}
				/>
			))}
		</div>
	);
}