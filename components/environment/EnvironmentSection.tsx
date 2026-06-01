"use client";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { panelTheme } from "@/lib/helpers/panelTheme";
import { ActiveViz, AggregatedAirQualityData, AirQualityDataset, Dataset, SelectedArea } from "@lib/types";
import AirQualityChart from "./air-quality/AirQualityChart";

interface EnvironmentSectionProps {
	activeDataset: Dataset | null;
	availableAirQualityDatasets: Record<string, AirQualityDataset>;
	aggregatedAirQualityData: Record<number, AggregatedAirQualityData> | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function EnvironmentSection({
	activeDataset,
	availableAirQualityDatasets,
	aggregatedAirQualityData,
	selectedArea,
	activeViz,
	setActiveViz,
}: EnvironmentSectionProps) {
	const isDark = useIsDark();
	const t = panelTheme(isDark);
	const { visibility } = useChartVisibility();

	const showAirQuality = visibility["environment-airQuality"];
	const airQualityIds = Object.keys(availableAirQualityDatasets).sort();

	if (!showAirQuality || airQualityIds.length === 0) return null;

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<p className={`text-[11px] font-semibold pt-2 px-0.5 uppercase tracking-wide ${t.textMuted}`}>
				Environment
			</p>
			<div className="space-y-2">
				{showAirQuality && airQualityIds.map((id) => (
					<AirQualityChart
						key={id}
						activeDataset={activeDataset}
						availableDatasets={availableAirQualityDatasets}
						aggregatedData={aggregatedAirQualityData}
						selectedArea={selectedArea}
						year={Number(id)}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
					/>
				))}
			</div>
		</div>
	);
}
