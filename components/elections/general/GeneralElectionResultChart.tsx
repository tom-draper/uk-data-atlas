// components/GeneralElectionResultChart.tsx
"use client";


import { ActiveViz, GeneralElectionDataset } from "@lib/types";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { useIsDark } from "@/lib/context/ThemeContext";

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

function VoteBar({ data }: { data: ProcessedPartyData[] }) {
	return (
		<div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0 w-full">
			{data.map((p) => (
				<div
					key={p.key}
					style={{ width: `${p.percentage}%`, backgroundColor: p.color }}
					title={`${p.name}: ${p.votes.toLocaleString()} (${p.percentage.toFixed(
						1,
					)}%)`}
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
	);
}

function Legend({
	partyData,
	seatsSummary,
	totalSeats,
}: {
	partyData: ProcessedPartyData[];
	seatsSummary: { party: string; count: number; color: string }[] | null;
	totalSeats: number | null;
}) {
	const isDark = useIsDark();
	return (
		<div className="animate-in fade-in duration-200 mt-2">
			{/* Votes Legend */}
			<div className="grid grid-cols-3 gap-0.5 text-[9px]">
				{partyData.map((p) => (
					<div key={p.key} className="flex items-center gap-1">
						<div
							className="size-1.5 rounded-sm shrink-0"
							style={{ backgroundColor: p.color }}
						/>
						<span className="truncate font-medium">
							{p.key}: {p.votes.toLocaleString()}
						</span>
					</div>
				))}
			</div>

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
	isActive,
	setActiveViz,
}: {
	data: ProcessedYearData;
	isActive: boolean;
	setActiveViz: (val: ActiveViz) => void;
}) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const datasetId = `generalElection-${data.year}`;
	const winnerColor = data.partyData[0]?.color;

	const heightClass = isActive
		? data.isAggregated
			? "min-h-[205px]"
			: "min-h-[95px]"
		: "min-h-[65px]";

	const accentColor = winnerColor ?? "#6366f1";
	return (
		<ChartCard
			heading={`${data.year} General Election`}
			headerEnd={
				data.turnout !== null && (
					<span className="text-[9px] text-gray-500 font-medium">
						{data.turnout.toFixed(1)}% turnout
					</span>
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
