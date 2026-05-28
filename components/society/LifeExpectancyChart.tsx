"use client";
import {
	ActiveViz,
	AggregatedLifeExpectancyData,
	Dataset,
	LifeExpectancyDataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { hexToRgb, rgbToHex } from "@/lib/helpers/colorScale/interpolation";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";

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
const LE_LOW_RGB = hexToRgb("#fbbf24"); // amber-400
const LE_HIGH_RGB = hexToRgb("#16a34a"); // green-600

function leColorRgb(pct: number) {
	const t = pct / 100;
	return {
		r: Math.round(LE_LOW_RGB.r + (LE_HIGH_RGB.r - LE_LOW_RGB.r) * t),
		g: Math.round(LE_LOW_RGB.g + (LE_HIGH_RGB.g - LE_LOW_RGB.g) * t),
		b: Math.round(LE_LOW_RGB.b + (LE_HIGH_RGB.b - LE_LOW_RGB.b) * t),
	};
}

function computeLeStats(
	dataset: LifeExpectancyDataset,
	aggregatedData: Record<string, AggregatedLifeExpectancyData> | null,
	selectedArea: SelectedArea | null,
	datasetId: string,
	chartsLoading: boolean,
) {
	if (chartsLoading) return null;

	if (selectedArea === null) {
		if (aggregatedData?.[datasetId]) return aggregatedData[datasetId];
		return null;
	}

	if (selectedArea.type === "localAuthority") {
		const record = dataset.data[selectedArea.code];
		return record
			? {
					averageMaleLE: record.maleBirthLE,
					averageFemaleLE: record.femaleBirthLE,
				}
			: null;
	}

	if (selectedArea.type === "ward" && selectedArea.data) {
		const record = dataset.data[selectedArea.data.ladCode];
		return record
			? {
					averageMaleLE: record.maleBirthLE,
					averageFemaleLE: record.femaleBirthLE,
				}
			: null;
	}

	return null;
}

function computeBarRange(dataset: LifeExpectancyDataset, chartsLoading: boolean) {
	if (chartsLoading) return { min: 55, max: 85 };
	const vals = Object.values(dataset.data).flatMap((r) => [r.maleBirthLE, r.femaleBirthLE]);
	return { min: Math.min(...vals), max: Math.max(...vals) };
}

function leBar(
	years: number,
	label: string,
	min: number,
	max: number,
	isDark: boolean,
) {
	const pct = Math.max(0, Math.min(100, ((years - min) / (max - min)) * 100));
	const { r, g, b } = leColorRgb(pct);
	return (
		<div className="flex items-center gap-1.5">
			<span
				className={`text-[10px] w-3 ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
			>
				{label}
			</span>
			<div
				className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-100"}`}
			>
				<div
					className="h-full rounded-full"
					style={{
						width: `${pct}%`,
						backgroundColor: `rgba(${r}, ${g}, ${b}, 0.85)`,
					}}
				/>
			</div>
			<span
				className={`text-[10px] font-semibold w-8 text-right ${isDark ? "text-gray-300" : "text-gray-600"}`}
			>
				{years.toFixed(1)}
			</span>
		</div>
	);
}

export default function LifeExpectancyChart({
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
	const dataset = availableDatasets?.[datasetId];

	const leStats = dataset ? computeLeStats(dataset, aggregatedData, selectedArea, datasetId, chartsLoading) : null;
	const barRange = dataset ? computeBarRange(dataset, chartsLoading) : { min: 55, max: 85 };

	if (!dataset) return null;

	const isActive =
		activeDataset?.type === "lifeExpectancy" &&
		activeDataset.id === dataset.id;

	// Average of male + female bar pct → accent hex for border
	const accentColor = leStats
		? (() => {
				const malePct = Math.max(
					0,
					Math.min(
						100,
						((leStats.averageMaleLE - barRange.min) /
							(barRange.max - barRange.min)) *
							100,
					),
				);
				const femalePct = Math.max(
					0,
					Math.min(
						100,
						((leStats.averageFemaleLE - barRange.min) /
							(barRange.max - barRange.min)) *
							100,
					),
				);
				const { r, g, b } = leColorRgb((malePct + femalePct) / 2);
				return rgbToHex(r, g, b);
			})()
		: null;
	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		accentColor,
		isActive,
		isDark,
	);

	return (
		<div
			style={style}
			className={cardClass(isActive, isDark, "h-20")}
			title={dataset.metadata.source}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
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
				<h3 className={chartHeadingClass(isDark)}>
					{dataset.label} [{dataset.dataPeriod}]
				</h3>
				{leStats ? (
					<div className="mt-1.5 space-y-1">
						{leBar(
							leStats.averageMaleLE,
							"M",
							barRange.min,
							barRange.max,
							isDark,
						)}
						{leBar(
							leStats.averageFemaleLE,
							"F",
							barRange.min,
							barRange.max,
							isDark,
						)}
					</div>
				) : (
					<div className="h-5 mt-2 mb-2">
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
				)}
			</div>
		</div>
	);
}
