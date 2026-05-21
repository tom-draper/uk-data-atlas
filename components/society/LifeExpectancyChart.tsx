"use client";
import {
	ActiveViz,
	AggregatedLifeExpectancyData,
	Dataset,
	LifeExpectancyDataset,
	SelectedArea,
} from "@lib/types";
import { memo, useMemo, useState } from "react";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { hexToRgb } from "@/lib/helpers/colorScale/interpolation";

interface LifeExpectancyChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, LifeExpectancyDataset>;
	aggregatedData: Record<string, AggregatedLifeExpectancyData> | null;
	selectedArea: SelectedArea | null;
	datasetId: string;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

// Amber (low LE) → green (high LE)
const LE_LOW_RGB = hexToRgb("#fbbf24");  // amber-400
const LE_HIGH_RGB = hexToRgb("#16a34a"); // green-600

function leColorRgb(pct: number) {
	const t = pct / 100;
	return {
		r: Math.round(LE_LOW_RGB.r + (LE_HIGH_RGB.r - LE_LOW_RGB.r) * t),
		g: Math.round(LE_LOW_RGB.g + (LE_HIGH_RGB.g - LE_LOW_RGB.g) * t),
		b: Math.round(LE_LOW_RGB.b + (LE_HIGH_RGB.b - LE_LOW_RGB.b) * t),
	};
}

function lightenRgb({ r, g, b }: { r: number; g: number; b: number }, factor: number) {
	return `rgb(${Math.round(r + (255 - r) * factor)}, ${Math.round(g + (255 - g) * factor)}, ${Math.round(b + (255 - b) * factor)})`;
}

function leBar(years: number, label: string, min: number, max: number, isDark: boolean) {
	const pct = Math.max(0, Math.min(100, ((years - min) / (max - min)) * 100));
	const { r, g, b } = leColorRgb(pct);
	return (
		<div className="flex items-center gap-1.5">
			<span className={`text-[10px] w-3 ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>{label}</span>
			<div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
				<div
					className="h-full rounded-full"
					style={{ width: `${pct}%`, backgroundColor: `rgba(${r}, ${g}, ${b}, 0.85)` }}
				/>
			</div>
			<span className={`text-[10px] font-semibold w-8 text-right ${isDark ? "text-gray-300" : "text-gray-600"}`}>
				{years.toFixed(1)}
			</span>
		</div>
	);
}

export default memo(function LifeExpectancyChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	datasetId,
	activeViz,
	setActiveViz,
}: LifeExpectancyChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const [hovered, setHovered] = useState(false);
	const dataset = availableDatasets?.[datasetId];

	const leStats = useMemo(() => {
		if (!dataset || chartsLoading) return null;

		if (selectedArea === null) {
			if (aggregatedData?.[datasetId]) return aggregatedData[datasetId];
			return null;
		}

		if (selectedArea.type === "localAuthority") {
			const record = dataset.data[selectedArea.code];
			return record
				? { averageMaleLE: record.maleBirthLE, averageFemaleLE: record.femaleBirthLE }
				: null;
		}

		if (selectedArea.type === "ward" && selectedArea.data) {
			const record = dataset.data[selectedArea.data.ladCode];
			return record
				? { averageMaleLE: record.maleBirthLE, averageFemaleLE: record.femaleBirthLE }
				: null;
		}

		return null;
	}, [dataset, aggregatedData, datasetId, selectedArea, chartsLoading]);

	const barRange = useMemo(() => {
		if (!dataset || chartsLoading) return { min: 55, max: 85 };
		const vals = Object.values(dataset.data).flatMap((r) => [r.maleBirthLE, r.femaleBirthLE]);
		return { min: Math.min(...vals), max: Math.max(...vals) };
	}, [dataset, chartsLoading]);

	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "lifeExpectancy" && activeDataset.id === dataset.id;

	// Average of male + female bar pct → border color
	const accentRgb = leStats
		? (() => {
			const malePct = Math.max(0, Math.min(100, ((leStats.averageMaleLE - barRange.min) / (barRange.max - barRange.min)) * 100));
			const femalePct = Math.max(0, Math.min(100, ((leStats.averageFemaleLE - barRange.min) / (barRange.max - barRange.min)) * 100));
			return leColorRgb((malePct + femalePct) / 2);
		})()
		: null;

	const dynamicStyle: React.CSSProperties = (() => {
		if (!accentRgb || (!isActive && !hovered)) return {};
		const style: React.CSSProperties = { borderColor: lightenRgb(accentRgb, 0.45) };
		if (isActive) {
			const { r, g, b } = accentRgb;
			style.backgroundColor = isDark
				? `rgba(${r}, ${g}, ${b}, 0.12)`
				: `rgba(${r}, ${g}, ${b}, 0.06)`;
		}
		return style;
	})();

	return (
		<div
			style={dynamicStyle}
			className={`p-2 rounded cursor-pointer overflow-hidden relative h-20 border-2 ${
				isActive
					? isDark ? "bg-white/10" : "bg-white/60"
					: isDark ? "bg-white/5 border-white/10" : "bg-white/60 border-gray-200/80"
			}`}
			title={dataset.metadata.source}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartLoadingBackground />
			<div className="relative z-10">
				<h3 className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-800/90"}`}>
					{dataset.label} [{dataset.dataPeriod}]
				</h3>
				{leStats ? (
					<div className="mt-1.5 space-y-1">
						{leBar(leStats.averageMaleLE, "M", barRange.min, barRange.max, isDark)}
						{leBar(leStats.averageFemaleLE, "F", barRange.min, barRange.max, isDark)}
					</div>
				) : (
					<div className="h-5 mt-2 mb-2">
						{chartsLoading ? (
							<ChartContentPlaceholder className="h-full" />
						) : (
							<div className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
								No data available
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
});
