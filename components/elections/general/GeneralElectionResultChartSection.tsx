// components/GeneralElectionResultChart.tsx
"use client";

import { PARTIES } from "@/lib/data/election/parties";
import {
	calculateTurnout,
	processPartyVotes,
} from "@/lib/helpers/generalElection";
import {
	ActiveViz,
	AggregatedGeneralElectionData,
	Dataset,
	GENERAL_ELECTION_YEARS,
	GeneralElectionDataset,
	PartyVotes,
	SelectedArea,
	PartyCode,
	ProcessedPartyData,
} from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import GeneralElectionResultChart from "./GeneralElectionResultChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { useMemo } from "react";
import {
	useChartVisibility,
	ChartKey,
} from "@/lib/context/ChartVisibilityContext";
import { useExcludedCategories } from "@/lib/context/ExcludedCategoriesContext";

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
	aggregatedData: Record<number, AggregatedGeneralElectionData> | null,
	selectedArea: SelectedArea | null,
	getCodeForYear?: (
		type: "constituency",
		code: string,
		targetYear: number,
	) => string | undefined,
	excluded?: Set<string>,
	selectedParty?: string,
) => {
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
				const constituencyCode = selectedArea.code;
				let data = dataset.data?.[constituencyCode];

				if (!data && getCodeForYear) {
					const mappedCode = getCodeForYear(
						"constituency",
						constituencyCode,
						year,
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
						data.electorate,
					);
				}
			} else if (selectedArea === null && aggregatedData?.[year]) {
				const agg = aggregatedData[year];
				if (agg.partyVotes) {
					rawPartyVotes = agg.partyVotes as PartyVotes;
					turnout = calculateTurnout(
						agg.validVotes,
						agg.invalidVotes,
						agg.electorate,
					);
					isAggregated = true;
					totalSeats = agg.totalSeats;

					seatsSummary = Object.entries(agg.partySeats)
						.sort(([, a], [, b]) => (b as number) - (a as number))
						.map(([key, count]) => ({
							party: key as PartyCode,
							count: count as number,
							color: PARTIES[key as PartyCode]?.color || "#ccc",
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

			const filteredVotes = excluded?.size || selectedParty
				? Object.fromEntries(
						Object.entries(rawPartyVotes).filter(
							([party]) =>
								!excluded?.has(party) &&
								(!selectedParty || party === selectedParty),
						),
					)
				: rawPartyVotes;
			const partyData = processPartyVotes(
				filteredVotes,
				dataset.partyInfo,
			);
			const totalVotes = partyData.reduce((a, p) => a + p.votes, 0);

			return {
				year,
				dataset,
				partyData,
				totalVotes,
				turnout,
				isAggregated,
				seatsSummary,
				totalSeats,
				hasData: partyData.length > 0,
			};
	});
};

interface GeneralElectionResultChartSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, GeneralElectionDataset>;
	selectedArea: SelectedArea | null;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export default function GeneralElectionResultChartSection({
	activeDataset,
	availableDatasets,
	selectedArea,
	activeViz,
	setActiveViz,
	codeMapper,
	mapManager,
	boundaryData,
	location,
}: GeneralElectionResultChartSectionProps) {
	const { visibility } = useChartVisibility();
	const { excludedGeneralParties, selectedGeneralParty } = useExcludedCategories();
	const aggregatedData = useMemo(
		() => aggregateDataset({ datasets: availableDatasets, boundaryType: "constituency", calculateStats: (mm, g, d, loc, id) => mm.calculateGeneralElectionStats(g, d, loc, id) }, mapManager, boundaryData, location),
		[availableDatasets, mapManager, boundaryData, location],
	) as Record<number, AggregatedGeneralElectionData> | null;
	const yearData = useElectionChartData(
		availableDatasets,
		aggregatedData,
		selectedArea,
		codeMapper?.getCodeForYear,
		excludedGeneralParties,
		selectedGeneralParty,
	);

	const visibleYearData = yearData.filter(
		(d) => visibility[`generalElection-${d.year}` as ChartKey],
	);

	if (visibleYearData.length === 0) return null;

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-bold pt-2">General Election Results</h3>
			{visibleYearData.map((data) => (
				<GeneralElectionResultChart
					key={data.year}
					data={data}
					isActive={
						(activeDataset &&
							((activeDataset.type === "generalElection" &&
								activeDataset.id ===
									`generalElection-${data.year}`) ||
								(activeViz.datasetType === "custom" &&
									activeViz.vizId === "custom"))) as boolean
					}
					setActiveViz={setActiveViz}
				/>
			))}
		</div>
	);
}
