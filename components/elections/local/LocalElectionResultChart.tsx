// components/LocalElectionResultChart.tsx
"use client";

import { LocalElectionDataset, ActiveViz } from "@lib/types";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	PartyVotesGrid,
	VoteBar,
	type PartyVotes,
} from "@/components/elections/PartyVotes";

interface ProcessedYearData {
	year: number;
	dataset: LocalElectionDataset | null;
	partyData: PartyVotes[];
	totalVotes: number;
	turnout: number | null;
	hasData: boolean;
	boundariesChanged?: boolean;
	boundariesRedrawn?: boolean;
}

function Legend({ partyData }: { partyData: PartyVotes[] }) {
	return (
		<div className="animate-in fade-in duration-200 mt-1">
			<PartyVotesGrid partyData={partyData} />
		</div>
	);
}

export default function LocalElectionResultChart({
	data,
	isActive,
	setActiveViz,
}: {
	data: ProcessedYearData;
	isActive: boolean;
	setActiveViz: (val: ActiveViz) => void;
}) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const winnerColor = data.partyData[0]?.color;

	const heightClass = isActive ? "min-h-[95px]" : "min-h-[65px]";

	const accentColor = winnerColor ?? "#6366f1";
	const handleActivate = () => {
		if (data.dataset) {
			setActiveViz({
				datasetId: data.dataset.id,
				datasetType: data.dataset.type,
				datasetYear: data.dataset.year,
			});
		}
	};

	return (
		<ChartCard
			heading={`${data.year} Local Elections`}
			headerEnd={
				data.turnout || data.boundariesRedrawn ? (
					<span className="flex items-center gap-1.5 text-[9px] text-gray-500 font-medium">
						{data.boundariesRedrawn && (
							<span title="This ward was redrawn slightly between this election and the map's boundaries; these are the results for the ward as it was then.">
								Redrawn
							</span>
						)}
						{data.turnout ? (
							<span>{data.turnout.toFixed(1)}% turnout</span>
						) : null}
					</span>
				) : null
			}
			accent={accentColor}
			isActive={isActive}
			minHeightClassName={`transition-[min-height] duration-300 ease-in-out ${heightClass}`}
			title="House of Commons Library, UK Parliament. Local Election Results. commonslibrary.parliament.uk"
			onClick={handleActivate}
		>
			<div className="relative z-[1] flex-1 flex flex-col">
				{!data.hasData ? (
					chartsLoading ? (
						<ChartContentPlaceholder className="flex-1 mt-1" />
					) : (
						<div
							className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							{data.boundariesChanged
								? "Ward boundaries changed"
								: "No data available"}
						</div>
					)
				) : (
					<div className="space-y-1">
						<VoteBar data={data.partyData} />
						{isActive && <Legend partyData={data.partyData} />}
					</div>
				)}
			</div>
		</ChartCard>
	);
}
