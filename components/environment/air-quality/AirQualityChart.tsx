"use client";
import {
	ActiveViz,
	AggregatedAirQualityData,
	AirQualityDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import { ChartCard } from "@/components/ChartCard";
import { ChartDataPlaceholder } from "@/components/ChartDataPlaceholder";
import {
	isLocalAuthorityEstimate,
	LOCAL_AUTHORITY_ESTIMATE_NOTE,
} from "@/components/LocalAuthorityEstimateIndicator";
import { MetricPill } from "@/components/MetricPill";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useCurrentMapOptions } from "@/lib/context/MapOptionsContext";
import { localAuthorityStats } from "@/lib/helpers/localAuthorityStats";
import type { LadResolver } from "@/lib/helpers/selectedAreaLad";

interface AirQualityChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, AirQualityDataset>;
	aggregatedData: Record<number, AggregatedAirQualityData> | null;
	selectedArea: SelectedArea | null;
	year: number;
	activeViz: ActiveViz;
	codeMapper?: LadResolver;
	setActiveViz: (value: ActiveViz) => void;
}

const ACCENT = "#22c55e";

const MEASURES = {
	no2: { key: "no2Mean", label: "NO₂" },
	pm25: { key: "pm25Mean", label: "PM2.5" },
	pm10: { key: "pm10Mean", label: "PM10" },
} as const;

export default function AirQualityChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	year,
	setActiveViz,
}: AirQualityChartProps) {
	const isDark = useIsDark();
	const measure = useCurrentMapOptions().airQuality.measure;
	const measureInfo = MEASURES[measure];
	const dataset = availableDatasets?.[year];

	const stats = dataset
		? localAuthorityStats(
				dataset,
				aggregatedData,
				selectedArea,
				codeMapper,
				(record) => ({
					no2Mean: record.no2Mean,
					pm25Mean: record.pm25Mean,
					pm10Mean: record.pm10Mean,
				}),
			)
		: null;

	const isActive =
		activeDataset?.type === "airQuality" &&
		activeDataset.id === dataset?.id;

	if (!dataset) return null;

	const value = stats?.[measureInfo.key] ?? null;

	return (
		<ChartCard
			heading={`Air Quality, ${measureInfo.label} [${dataset.year}]`}
			estimateNote={
				isLocalAuthorityEstimate(selectedArea, stats !== null)
					? LOCAL_AUTHORITY_ESTIMATE_NOTE
					: undefined
			}
			accent={stats ? ACCENT : null}
			isActive={isActive}
			title="Defra. Pollution Climate Mapping background maps, 2024. uk-air.defra.gov.uk"
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			{!stats ? (
				<ChartDataPlaceholder />
			) : (
				<div className="flex items-end justify-between gap-1.5 flex-1">
					<div className="flex items-baseline gap-1">
						<span
							className="text-2xl font-bold leading-none"
							style={{
								color: value != null ? ACCENT : undefined,
							}}
						>
							{value != null ? value.toFixed(1) : "—"}
						</span>
						<span
							className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}
						>
							µg/m³
						</span>
					</div>
					<div className="flex gap-1 shrink-0">
						<MetricPill
							label="PM2.5"
							value={stats.pm25Mean}
							unit="µg/m³"
						/>
						<MetricPill
							label="PM10"
							value={stats.pm10Mean}
							unit="µg/m³"
						/>
					</div>
				</div>
			)}
		</ChartCard>
	);
}
