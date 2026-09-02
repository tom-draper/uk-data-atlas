"use client";
import {
	ActiveViz,
	AggregatedAirQualityData,
	AirQualityDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";

interface AirQualityChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, AirQualityDataset>;
	aggregatedData: Record<number, AggregatedAirQualityData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const ACCENT = "#22c55e";

function no2Color(no2: number): string {
	if (no2 < 10) return "#22c55e";
	if (no2 < 20) return "#eab308";
	if (no2 < 30) return "#f97316";
	return "#ef4444";
}


function StatPill({
	label,
	value,
	unit,
	isDark,
}: {
	label: string;
	value: number | null;
	unit: string;
	isDark: boolean;
}) {
	return (
		<div className={`flex flex-col items-center px-2 py-1 rounded ${isDark ? "bg-white/5" : "bg-black/5"}`}>
			<span className={`text-[9px] font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}>{label}</span>
			<span className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-800"}`}>
				{value != null ? `${value.toFixed(1)}` : "—"}
				{value != null && <span className="text-[9px] font-normal ml-0.5">{unit}</span>}
			</span>
		</div>
	);
}

function computeStats(
	dataset: AirQualityDataset,
	aggregatedData: Record<number, AggregatedAirQualityData> | null,
	selectedArea: SelectedArea | null,
): AggregatedAirQualityData | null {
	if (selectedArea === null) return aggregatedData?.[dataset.year] ?? null;

	const fromRecord = (code: string) => {
		const r = dataset.data[code];
		if (!r) return null;
		return { no2Mean: r.no2Mean, pm25Mean: r.pm25Mean, pm10Mean: r.pm10Mean };
	};

	if (selectedArea.type === "localAuthority") return fromRecord(selectedArea.code);
	if (selectedArea.type === "ward" && selectedArea.data?.ladCode) return fromRecord(selectedArea.data.ladCode);
	return null;
}

export default function AirQualityChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	year,
	setActiveViz,
}: AirQualityChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? computeStats(dataset, aggregatedData, selectedArea)
		: null;

	const isActive =
		activeDataset?.type === "airQuality" && activeDataset.id === dataset?.id;

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		stats ? ACCENT : null,
		isActive,
		isDark,
	);

	if (!dataset) return null;

	const no2 = stats?.no2Mean ?? null;
	const color = no2 != null ? no2Color(no2) : null;

	return (
		<button
			type="button"
			style={style}
			className={cardClass(isActive, isDark, "min-h-20")}
			title="DEFRA. Air Quality Statistics in the UK. uk-air.defra.gov.uk"
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
			<div className="relative z-10 flex items-center justify-between mb-1.5 shrink-0">
				<h3 className={chartHeadingClass(isDark)}>Air Quality, NO₂ [{dataset.year}]</h3>
			</div>

			{!stats ? (
				<div className="flex-1 mt-1">
					{chartsLoading ? (
						<ChartContentPlaceholder className="h-full" />
					) : (
						<div className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
							No data available
						</div>
					)}
				</div>
			) : (
				<div className="flex items-end justify-between gap-1.5 flex-1">
					<div className="flex items-baseline gap-1">
						<span className="text-2xl font-bold leading-none" style={{ color: color ?? undefined }}>
							{no2 != null ? no2.toFixed(1) : "—"}
						</span>
						<span className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
							µg/m³
						</span>
					</div>
					<div className="flex gap-1 shrink-0">
						<StatPill label="PM2.5" value={stats.pm25Mean} unit="µg/m³" isDark={isDark} />
						<StatPill label="PM10" value={stats.pm10Mean} unit="µg/m³" isDark={isDark} />
					</div>
				</div>
			)}
		</button>
	);
}
