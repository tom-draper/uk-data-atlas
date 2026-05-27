// components/LocalElectionResultChart.tsx
"use client";

import { memo, useMemo } from "react";
import {
	calculateTurnout,
	processPartyVotes,
} from "@/lib/helpers/generalElection";
import {
	ActiveViz,
	AggregatedLocalElectionData,
	Dataset,
	LOCAL_ELECTION_YEARS,
	LocalElectionDataset,
	PartyVotes,
	SelectedArea,
	ProcessedPartyData,
} from "@lib/types";
import LocalElectionResultChart from "./LocalElectionResultChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	useChartVisibility,
	ChartKey,
} from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";

interface ProcessedYearData {
	year: number;
	dataset: LocalElectionDataset | null;
	partyData: ProcessedPartyData[];
	totalVotes: number;
	turnout: number | null;
	hasData: boolean;
}

// Cache LAD vote aggregations — keyed by ladCode, then election year
const MAX_LAD_CACHE_ENTRIES = 50;
const localElectionLadCache = new Map<
	string,
	Map<
		number,
		{ partyVotes: Record<string, number>; electorate: number } | null
	>
>();

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
	getWardsForConstituency?: (
		constituencyCode: string,
		wardYear: number,
	) => string[],
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
			} else if (
				selectedArea &&
				selectedArea.type === "localAuthority" &&
				getWardsForLad
			) {
				const ladCode = selectedArea.code;

				// Check cache first
				if (!localElectionLadCache.has(ladCode)) {
					if (localElectionLadCache.size >= MAX_LAD_CACHE_ENTRIES) {
						localElectionLadCache.delete(
							localElectionLadCache.keys().next().value!,
						);
					}
					localElectionLadCache.set(ladCode, new Map());
				}
				const yearCache = localElectionLadCache.get(ladCode)!;

				let cached = yearCache.get(year);
				if (!yearCache.has(year)) {
					const wardCodes = getWardsForLad(ladCode, year);
					const aggregatedVotes: Record<string, number> = {};
					let totalElectorate = 0;

					for (const wardCode of wardCodes) {
						let wardData = dataset.data[wardCode];

						if (!wardData && getCodeForYear) {
							const mappedCode = getCodeForYear(
								"ward",
								wardCode,
								year,
							);
							if (mappedCode) {
								wardData = dataset.data[mappedCode];
							}
						}

						if (wardData?.partyVotes) {
							for (const [partyKey, votes] of Object.entries(
								wardData.partyVotes,
							)) {
								aggregatedVotes[partyKey] =
									(aggregatedVotes[partyKey] || 0) +
									(votes || 0);
							}
							if (wardData.electorate) {
								totalElectorate += wardData.electorate;
							}
						}
					}

					const totalVotes = Object.values(aggregatedVotes).reduce(
						(sum, v) => sum + (v || 0),
						0,
					);
					cached =
						totalVotes > 0
							? {
									partyVotes: aggregatedVotes,
									electorate: totalElectorate,
								}
							: null;
					yearCache.set(year, cached);
				}

				if (cached) {
					rawPartyVotes = cached.partyVotes as PartyVotes;
					if (cached.electorate > 0) {
						const totalVotes = Object.values(
							cached.partyVotes,
						).reduce((s, v) => s + (v || 0), 0);
						turnout = calculateTurnout(
							totalVotes,
							0,
							cached.electorate,
						);
					}
				}
			} else if (
				selectedArea &&
				selectedArea.type === "constituency" &&
				getWardsForConstituency
			) {
				const constituencyCode = selectedArea.code;
				const wardCodes = getWardsForConstituency(
					constituencyCode,
					dataset.boundaryYear,
				);
				const aggregatedVotes: Record<string, number> = {};
				let totalElectorate = 0;

				for (const wardCode of wardCodes) {
					let wardData = dataset.data[wardCode];
					if (!wardData && getCodeForYear) {
						const mapped = getCodeForYear("ward", wardCode, year);
						if (mapped) wardData = dataset.data[mapped];
					}
					if (wardData?.partyVotes) {
						for (const [party, votes] of Object.entries(
							wardData.partyVotes,
						)) {
							aggregatedVotes[party] =
								(aggregatedVotes[party] || 0) + (votes || 0);
						}
						if (wardData.electorate)
							totalElectorate += wardData.electorate;
					}
				}

				const totalVotes = Object.values(aggregatedVotes).reduce(
					(s, v) => s + (v || 0),
					0,
				);
				if (totalVotes > 0) {
					rawPartyVotes = aggregatedVotes as PartyVotes;
					if (totalElectorate > 0) {
						turnout = calculateTurnout(
							totalVotes,
							0,
							totalElectorate,
						);
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

			const partyData = processPartyVotes(
				rawPartyVotes,
				dataset.partyInfo,
			);
			const totalVotes = partyData.reduce((a, p) => a + p.votes, 0);

			return {
				year,
				dataset,
				partyData,
				totalVotes,
				turnout,
				hasData: partyData.length > 0,
			};
		});
	}, [
		availableDatasets,
		aggregatedData,
		selectedArea,
		getCodeForYear,
		getWardsForLad,
		getWardsForConstituency,
	]);
};

interface LocalElectionResultChartSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, LocalElectionDataset>;
	aggregatedData: Record<number, AggregatedLocalElectionData> | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: CodeMapper;
}

export default memo(function LocalElectionResultChartSection({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	activeViz,
	setActiveViz,
	codeMapper,
}: LocalElectionResultChartSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const yearData = useLocalElectionData(
		availableDatasets,
		aggregatedData,
		selectedArea,
		codeMapper?.getCodeForYear,
		codeMapper?.getWardsForLad,
		codeMapper?.getWardsForConstituency,
	);

	const visibleYearData = yearData.filter(
		(d) => visibility[`localElection-${d.year}` as ChartKey],
	);

	if (visibleYearData.length === 0) return null;

	return (
		<div
			className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}
		>
			<h3
				className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-700"}`}
			>
				Local Election Results
			</h3>

			{visibleYearData.map((data) => (
				<LocalElectionResultChart
					key={data.year}
					data={data}
					isActive={
						(activeDataset &&
							((activeDataset.type === "localElection" &&
								activeDataset.id ===
									`localElection${data.year}`) ||
								(activeViz.datasetType === "custom" &&
									activeViz.vizId === "custom"))) as boolean
					}
					setActiveViz={setActiveViz}
				/>
			))}
		</div>
	);
});
