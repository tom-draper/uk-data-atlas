"use client";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	ActiveViz,
	AggregatedLifeExpectancyData,
	Dataset,
	LifeExpectancyDataset,
	SelectedArea,
} from "@lib/types";
import LifeExpectancyChart from "./LifeExpectancyChart";

interface HealthSectionProps {
	activeDataset: Dataset | null;
	availableLifeExpectancyDatasets: Record<string, LifeExpectancyDataset>;
	aggregatedLifeExpectancyData: Record<number, AggregatedLifeExpectancyData> | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function HealthSection({
	activeDataset,
	availableLifeExpectancyDatasets,
	aggregatedLifeExpectancyData,
	selectedArea,
	activeViz,
	setActiveViz,
}: HealthSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showLE = visibility["health-lifeExpectancy"];
	const showHLE = visibility["health-healthyLifeExpectancy"];

	if (!showLE && !showHLE) return null;

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
		</div>
	);
}
