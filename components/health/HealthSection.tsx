"use client";
import { useMemo } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ActiveViz, Dataset, LifeExpectancyDataset, NHSWaitingDataset, SelectedArea } from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import LifeExpectancyChart from "./LifeExpectancyChart";
import NHSWaitingChart from "./NHSWaitingChart";

interface HealthSectionProps {
	activeDataset: Dataset | null;
	availableLifeExpectancyDatasets: Record<string, LifeExpectancyDataset>;
	availableNHSWaitingDatasets: Record<string, NHSWaitingDataset>;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export default function HealthSection({
	activeDataset,
	availableLifeExpectancyDatasets,
	availableNHSWaitingDatasets,
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
	const showNHS = visibility["health-nhsWaiting"];

	const aggregatedLifeExpectancyData = useMemo(
		() => aggregateDataset(
			{ datasets: availableLifeExpectancyDatasets, boundaryType: "localAuthority", keyBy: "id", calculateStats: (mm, g, d, loc, id) => mm.calculateLifeExpectancyStats(g, d, loc, id) },
			mapManager, boundaryData, location,
		),
		[availableLifeExpectancyDatasets, mapManager, boundaryData, location],
	);
	const aggregatedNHSWaitingData = useMemo(
		() => aggregateDataset(
			{
				datasets: availableNHSWaitingDatasets,
				boundaryType: "localAuthority",
				calculateStats: (mm, g, _d, loc, id) => {
					const ds = availableNHSWaitingDatasets[id];
					return ds ? mm.calculateNHSWaitingStats(g, ds, loc, id) : null;
				},
			},
			mapManager, boundaryData, location,
		),
		[availableNHSWaitingDatasets, mapManager, boundaryData, location],
	);

	if (!showLE && !showHLE && !showNHS) return null;

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
			{showNHS && (
				<NHSWaitingChart
					activeDataset={activeDataset}
					availableDatasets={availableNHSWaitingDatasets}
					aggregatedData={aggregatedNHSWaitingData}
					selectedArea={selectedArea}
					year={2026}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			)}
		</div>
	);
}
