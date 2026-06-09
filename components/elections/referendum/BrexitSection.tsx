// components/referendum/BrexitSection.tsx
"use client";

import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ActiveViz, BrexitConstituencyDataset, BrexitLADDataset, Dataset, SelectedArea } from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import BrexitHanrettyEstimatesChart from "./BrexitHanrettyEstimatesChart";
import BrexitElectoralChart from "./BrexitElectoralChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface BrexitSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, BrexitLADDataset>;
	availableConstituencyDatasets: Record<string, BrexitConstituencyDataset>;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export default function BrexitSection({
	activeDataset,
	availableDatasets,
	availableConstituencyDatasets,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
	mapManager,
	boundaryData,
	location,
}: BrexitSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showHanretty = visibility["brexit-hanretty"];
	const showElectoral = visibility["brexit-electoral"];

	if (!showHanretty && !showElectoral) return null;

	const aggregatedData = aggregateDataset(
		{ datasets: availableDatasets, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateBrexitStats(g, d, loc, id) },
		mapManager, boundaryData, location,
	);
	const aggregatedConstituencyData = aggregateDataset(
		{ datasets: availableConstituencyDatasets, boundaryType: "constituency", calculateStats: (mm, g, d, loc, id) => mm.calculateBrexitConstituencyStats(g, d, loc, id) },
		mapManager, boundaryData, location,
	);

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
				Brexit
			</h3>
			{showElectoral && (
				<BrexitElectoralChart
					activeDataset={activeDataset}
					availableDatasets={availableDatasets}
					aggregatedData={aggregatedData}
					year={2016}
					selectedArea={selectedArea}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			)}
			{showHanretty && (
				<BrexitHanrettyEstimatesChart
					activeDataset={activeDataset}
					availableDatasets={availableConstituencyDatasets}
					aggregatedData={aggregatedConstituencyData}
					year={2016}
					selectedArea={selectedArea}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			)}
		</div>
	);
}
