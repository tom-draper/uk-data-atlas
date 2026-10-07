// components/GeneralElectionResultChart.tsx
"use client";

import { ActiveViz, GeneralElectionDataset, SelectedArea } from "@lib/types";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import {
	CONSTITUENCY_ESTIMATE_NOTE,
	isConstituencyEstimate,
} from "@/components/ConstituencyEstimateIndicator";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	PartyVotesGrid,
	VoteBar,
	type PartyVotes,
} from "@/components/elections/PartyVotes";

interface ProcessedYearData {
	year: number;
	dataset: GeneralElectionDataset | null;
	partyData: PartyVotes[];
	totalVotes: number;
	turnout: number | null;
	isAggregated: boolean;
	seatsSummary: { party: string; count: number; color: string }[] | null;
	totalSeats: number | null;
	viaConstituency: boolean;
	hasData: boolean;
}

function Legend({
	partyData,
	seatsSummary,
	totalSeats,
}: {
	partyData: PartyVotes[];
	seatsSummary: { party: string; count: number; color: string }[] | null;
	totalSeats: number | null;
}) {
	const isDark = useIsDark();
	return (
		<div className="animate-in fade-in duration-200 mt-2">
			{/* Votes Legend */}
			<PartyVotesGrid partyData={partyData} />

			{/* Seats Legend (Aggregated Only) */}
			{seatsSummary && (
				<div
					className={`mt-2 pt-2 border-t ${isDark ? "border-white/10" : "border-gray-200"}`}
				>
					<div className="text-[9px] font-medium text-gray-600 mb-1">
						Seats won: {totalSeats}
					</div>
					<div className="grid grid-cols-3 gap-0.5 text-[9px]">
						{seatsSummary.map((s) => (
							<div
								key={s.party}
								className="flex items-center gap-1"
							>
								<div
									className="size-1.5 rounded-sm shrink-0"
									style={{ backgroundColor: s.color }}
								/>
								<span className="truncate font-medium">
									{s.party}: {s.count}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

export default function GeneralElectionResultChart({
	data,
	selectedArea,
	isActive,
	setActiveViz,
}: {
	data: ProcessedYearData;
	selectedArea: SelectedArea | null;
	isActive: boolean;
	setActiveViz: (val: ActiveViz) => void;
}) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const datasetId = `generalElection-${data.year}`;
	const winnerColor = data.partyData[0]?.color;

	// An active general-election card can show the national seats breakdown.
	// Reserve that compact layout from the loading state onwards so hovering a
	// constituency cannot move every card below it.
	const heightClass = isActive ? "min-h-[205px]" : "min-h-[65px]";

	const accentColor = winnerColor ?? "#6366f1";
	return (
		<ChartCard
			heading={`${data.year} General Election`}
			estimateNote={
				isConstituencyEstimate(selectedArea, data.viaConstituency)
					? CONSTITUENCY_ESTIMATE_NOTE
					: undefined
			}
			headerEnd={
				data.turnout !== null && (
					<div className="flex items-center gap-1 text-[9px] text-gray-500 font-medium">
						<span>{data.turnout.toFixed(1)}% turnout</span>
					</div>
				)
			}
			accent={accentColor}
			isActive={isActive}
			minHeightClassName={`transition-[min-height] duration-300 ease-in-out ${heightClass}`}
			title="House of Commons Library, UK Parliament. UK General Election Results. commonslibrary.parliament.uk"
			onClick={() =>
				data.dataset &&
				setActiveViz({
					datasetId: datasetId,
					datasetType: data.dataset.type,
					datasetYear: data.year,
				})
			}
		>
			<div className="relative z-[1] flex-1 flex flex-col">
				{!data.hasData ? (
					chartsLoading ? (
						<ChartContentPlaceholder className="flex-1 mt-1" />
					) : (
						<div
							className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							No data available
						</div>
					)
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
		</ChartCard>
	);
}
