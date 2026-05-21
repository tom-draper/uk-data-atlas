// components/LocalElectionResultChart.tsx
"use client";

import { memo, useState } from "react";
import { LocalElectionDataset, ActiveViz } from "@lib/types";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { hexToRgb } from "@/lib/helpers/colorScale/interpolation";

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

const VoteBar = memo(({ data }: { data: ProcessedPartyData[] }) => (
	<div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0 w-full">
		{data.map((p) => (
			<div
				key={p.key}
				style={{ width: `${p.percentage}%`, backgroundColor: p.color }}
				title={`${p.name}: ${p.votes.toLocaleString()} (${p.percentage.toFixed(1)}%)`}
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
));
VoteBar.displayName = "VoteBar";

const Legend = memo(({ partyData }: { partyData: ProcessedPartyData[] }) => (
	<div className="animate-in fade-in duration-200 mt-1">
		<div className="grid grid-cols-3 gap-0.5 text-[9px]">
			{partyData.map((p) => (
				<div key={p.key} className="flex items-center gap-1">
					<div
						className="w-1.5 h-1.5 rounded-sm shrink-0"
						style={{ backgroundColor: p.color }}
					/>
					<span className="truncate font-medium">
						{p.key}: {p.votes.toLocaleString()}
					</span>
				</div>
			))}
		</div>
	</div>
));
Legend.displayName = "Legend";

export default memo(function LocalElectionResultChart({
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
	const [hovered, setHovered] = useState(false);
	const winnerColor = data.partyData[0]?.color;

	const heightClass = isActive ? "h-[95px]" : "h-[65px]";

	const accentColor = winnerColor ?? "#6366f1";
	const showAccent = isActive || hovered;
	const dynamicStyle: React.CSSProperties = showAccent
		? {
			borderColor: accentColor,
			...(isActive && (() => {
				const rgb = hexToRgb(accentColor);
				return {
					backgroundColor: isDark
						? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`
						: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06)`,
				};
			})()),
		}
		: {};

	const handleActivate = () => {
		if (data.dataset) {
			setActiveViz({
				vizId: data.dataset.id,
				datasetType: data.dataset.type,
				datasetYear: data.dataset.year,
			});
		}
	};

	return (
		<div
			style={dynamicStyle}
			className={`
        p-2 rounded transition-[height] duration-300 ease-in-out cursor-pointer overflow-hidden relative border-2
        ${heightClass}
        ${isActive
				? isDark ? "bg-white/10" : "bg-white/60"
				: isDark ? "bg-white/5 border-white/10" : "bg-white/60 border-gray-200/80"
			}
      `}
			title="House of Commons Library, UK Parliament. Local Election Results. commonslibrary.parliament.uk"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onClick={handleActivate}
		>
			<ChartLoadingBackground />
			<div className="relative z-[1]">
				<div className="flex items-center justify-between mb-1.5">
					<h3 className="text-xs font-bold">
						{data.year} Local Elections
					</h3>
					{data.turnout && (
						<span className="text-[9px] text-gray-500 font-medium">
							{data.turnout.toFixed(1)}% turnout
						</span>
					)}
				</div>

				{!data.hasData ? (
					chartsLoading ? (
						<ChartContentPlaceholder className="h-5 mt-1" />
					) : (
						<div className="text-xs text-gray-400/80 pt-0.5 text-center">
							No data available
						</div>
					)
				) : (
					<div className="space-y-1">
						<VoteBar data={data.partyData} />
						{isActive && <Legend partyData={data.partyData} />}
					</div>
				)}
			</div>
		</div>
	);
});
