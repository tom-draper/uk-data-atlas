"use client";
import { useMemo } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ActiveViz, Dataset, Datasets, SelectedArea } from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import LifeExpectancyChart from "./LifeExpectancyChart";
import ScalarChartCards, { hasVisibleScalarChart } from "@/components/ScalarChartCards";

interface HealthSectionProps {
	activeDataset: Dataset | null;
	datasets: Datasets;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export default function HealthSection({
	activeDataset,
	datasets,
	selectedArea,
	activeViz,
	setActiveViz,
	mapManager,
	boundaryData,
	location,
}: HealthSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showLE = visibility["health-lifeExpectancy"];
	const showHLE = visibility["health-healthyLifeExpectancy"];
	const showScalarCharts = hasVisibleScalarChart("Health", visibility);
	const availableLifeExpectancyDatasets = datasets.lifeExpectancy;

	const aggregatedLifeExpectancyData = useMemo(
		() => aggregateDataset(
			{ datasets: availableLifeExpectancyDatasets, boundaryType: "localAuthority", keyBy: "id", calculateStats: (mm, g, d, loc, id) => mm.calculateLifeExpectancyStats(g, d, loc, id) },
			mapManager, boundaryData, location,
		),
		[availableLifeExpectancyDatasets, mapManager, boundaryData, location],
	);
	if (!showLE && !showHLE && !showScalarCharts) return null;

	const leIds = Object.keys(availableLifeExpectancyDatasets).sort();

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
				Health
			</h3>
			{leIds.flatMap((id) =>
				(id === "le" ? showLE : id === "hle" ? showHLE : true)
					? [
							<LifeExpectancyChart
								key={id}
								activeDataset={activeDataset}
								availableDatasets={availableLifeExpectancyDatasets}
								aggregatedData={aggregatedLifeExpectancyData}
								selectedArea={selectedArea}
								datasetId={id}
								activeViz={activeViz}
								setActiveViz={setActiveViz}
							/>,
						]
					: [],
			)}
			<ScalarChartCards group="Health" visibility={visibility} activeDataset={activeDataset} datasets={datasets} selectedArea={selectedArea} activeViz={activeViz} setActiveViz={setActiveViz} mapManager={mapManager} boundaryData={boundaryData} location={location} />
		</div>
	);
}
