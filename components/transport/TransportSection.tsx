"use client";
import { useIsDark } from "@/lib/context/ThemeContext";
import { panelTheme } from "@/lib/helpers/panelTheme";
import { ActiveViz } from "@lib/types";
import { CustomDataset } from "@/lib/types/custom";
import { getColor } from "@/lib/helpers/colorScale/themes";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";
import { ChartLoadingBackground } from "@/components/ChartLoadingPlaceholder";

function RoadSafetyCard({
	dataset,
	isActive,
	setActiveViz,
}: {
	dataset: CustomDataset;
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
}) {
	const isDark = useIsDark();
	const points = dataset.points ?? [];
	const accent = getColor(1);
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		accent,
		isActive,
		isDark,
	);

	return (
		<button
			type="button"
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: "custom",
					datasetYear: 0,
				})
			}
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<ChartLoadingBackground />
			<div className="relative z-10 flex items-start justify-between mb-1.5 shrink-0">
				<h3 className={chartHeadingClass(isDark)}>{dataset.dataColumn}</h3>
			</div>
			<div className="flex-1 flex flex-col gap-1">
				<div className="flex items-baseline gap-2">
					<span
						className="text-2xl font-bold leading-none"
						style={{ color: accent }}
					>
						{points.length.toLocaleString("en-GB")}
					</span>
					<span
						className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
					>
						collisions
					</span>
				</div>
				<span
					className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					coloured by severity
				</span>
			</div>
		</button>
	);
}

export default function TransportSection({
	roadSafetyDatasets,
	activeViz,
	setActiveViz,
}: {
	roadSafetyDatasets: CustomDataset[];
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}) {
	const isDark = useIsDark();
	const t = panelTheme(isDark);

	if (roadSafetyDatasets.length === 0) return null;

	return (
		<div
			className={`space-y-2 border-t pt-2 ${isDark ? "border-white/10" : "border-gray-200/80"}`}
		>
			<p
				className={`text-[11px] font-semibold pt-2 px-0.5 uppercase tracking-wide ${t.textMuted}`}
			>
				Transport
			</p>
			<div className="space-y-2">
				{roadSafetyDatasets.map((ds) => (
					<RoadSafetyCard
						key={ds.id}
						dataset={ds}
						isActive={
							activeViz.datasetType === "custom" &&
							activeViz.vizId === ds.id
						}
						setActiveViz={setActiveViz}
					/>
				))}
			</div>
		</div>
	);
}
