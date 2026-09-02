"use client";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ActiveViz, Dataset, Datasets, SelectedArea } from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
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

export default function HealthSection(props: HealthSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	if (!hasVisibleScalarChart("Health", visibility)) return null;

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
				Health
			</h3>
			<ScalarChartCards group="Health" visibility={visibility} {...props} />
		</div>
	);
}
