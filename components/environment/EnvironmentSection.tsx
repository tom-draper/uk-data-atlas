"use client";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { panelTheme } from "@/lib/helpers/panelTheme";
import { ActiveViz, AirQualityDataset, Dataset, SelectedArea } from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import AirQualityChart from "./air-quality/AirQualityChart";

interface EnvironmentSectionProps {
	activeDataset: Dataset | null;
	availableAirQualityDatasets: Record<string, AirQualityDataset>;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export default function EnvironmentSection({
	activeDataset,
	availableAirQualityDatasets,
	selectedArea,
	activeViz,
	setActiveViz,
	mapManager,
	boundaryData,
	location,
}: EnvironmentSectionProps) {
	const isDark = useIsDark();
	const t = panelTheme(isDark);
	const { visibility } = useChartVisibility();

	const showAirQuality = visibility["environment-airQuality"];
	const airQualityIds = Object.keys(availableAirQualityDatasets).sort();

	if (!showAirQuality || airQualityIds.length === 0) return null;

	const aggregatedAirQualityData = aggregateDataset(
		{
			datasets: availableAirQualityDatasets,
			boundaryType: "localAuthority",
			calculateStats: (mm, g, d, loc, id) => mm.calculateAirQualityStats(g, d, loc, id),
		},
		mapManager,
		boundaryData,
		location,
	);

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
