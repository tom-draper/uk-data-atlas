"use client";
import { useMemo } from "react";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ActiveViz } from "@lib/types";
import { CustomDataset } from "@/lib/types/custom";
import { getColor } from "@/lib/helpers/colorScale/themes";
import { gazetteer } from "@/lib/data/gazetteer/static";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";

function RoadSafetyCard({
	dataset,
	isActive,
	setActiveViz,
	location,
}: {
	dataset: CustomDataset;
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
	location: string;
}) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const points = useMemo(() => {
		const allPoints = dataset.points ?? [];
		const bounds = gazetteer.boundsOf(location);
		if (!bounds) return allPoints;
		return allPoints.filter(
			(point) =>
				point.lng >= bounds[0] &&
				point.lng <= bounds[2] &&
				point.lat >= bounds[1] &&
				point.lat <= bounds[3],
		);
	}, [dataset.points, location]);
	const hasData = points.length > 0;
	const locationLabel = location === "United Kingdom" ? "Great Britain" : location;
	const averageSeverity = hasData
		? points.reduce((total, point) => total + point.value, 0) / points.length
		: 0;
	const severityBarWidth = (averageSeverity / 3) * 100;
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
			title="Department for Transport. Provisional road collision statistics for Great Britain, 2025."
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<ChartLoadingBackground />
			<div className="relative z-10 flex items-start justify-between mb-1.5 shrink-0">
				<h3 className={chartHeadingClass(isDark)}>{dataset.dataColumn}</h3>
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					{locationLabel}
				</span>
			</div>

			{!hasData ? (
				<div className="flex-1 mt-1">
					{chartsLoading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div
							className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							No data available
						</div>
					)}
				</div>
			) : (
				<div className="flex-1 flex flex-col gap-1">
					<div className="flex items-baseline justify-between">
						<div className="leading-none">
							<span
								className="text-2xl font-bold leading-none"
								style={{ color: accent }}
							>
								{points.length.toLocaleString("en-GB")}
							</span>
							<span
								className={`text-[10px] font-normal leading-none ml-0.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}
							>
								collisions
							</span>
						</div>
						<span
							className={`text-[9px] ${isDark ? "text-gray-500" : "text-gray-400"}`}
						>
							severity {averageSeverity.toFixed(1)} / 3
						</span>
					</div>
					<div
						className={`h-1.5 rounded-xs overflow-hidden ${isDark ? "bg-white/10" : "bg-black/8"}`}
					>
						<div
							className="h-full rounded-xs transition-all duration-300"
							style={{
								width: `${severityBarWidth}%`,
								backgroundColor: accent,
							}}
						/>
					</div>
				</div>
			)}
		</button>
	);
}

export default function TransportSection({
	roadSafetyDatasets,
	activeViz,
	setActiveViz,
	location,
}: {
	roadSafetyDatasets: CustomDataset[];
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	location: string;
}) {
	const isDark = useIsDark();

	if (roadSafetyDatasets.length === 0) return null;

	return (
		<div
			className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}
		>
			<h3
				className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}
			>
				Transport
			</h3>
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
						location={location}
					/>
				))}
			</div>
		</div>
	);
}
