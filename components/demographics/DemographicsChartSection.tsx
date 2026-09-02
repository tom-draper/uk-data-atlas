"use client";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import type { ActiveViz, Dataset, Datasets, SelectedArea } from "@lib/types";
import type { BoundaryData } from "@lib/types/boundaries";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import type { CodeMapper } from "@/lib/hooks/useCodeMapper";
import ScalarChartCards, { hasVisibleScalarChart } from "@/components/ScalarChartCards";

interface DemographicsChartSectionProps {
	activeDataset: Dataset | null;
	datasets: Datasets;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export default function DemographicsChartSection(props: DemographicsChartSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	if (!hasVisibleScalarChart("Demographics", visibility)) return null;
	return (
		<div className={`pt-2.5 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold mb-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>Demographics</h3>
			<div className="space-y-2">
				<ScalarChartCards group="Demographics" visibility={visibility} {...props} />
			</div>
		</div>
	);
}
