"use client";
import { useMemo } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import { ActiveViz, BroadbandDataset, Dataset, SelectedArea } from "@lib/types";
import { BoundaryData } from "@lib/types/boundaries";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import BroadbandChart from "./broadband/BroadbandChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface TelecomsSectionProps {
	activeDataset: Dataset | null;
	availableBroadbandDatasets: Record<string, BroadbandDataset>;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export default function TelecomsSection({
	activeDataset,
	availableBroadbandDatasets,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
	mapManager,
	boundaryData,
	location,
}: TelecomsSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showBroadband = visibility["telecoms-broadband"];

	const aggregatedBroadbandData = useMemo(
		() => aggregateDataset({ datasets: availableBroadbandDatasets, boundaryType: "localAuthority", calculateStats: (mm, g, d, loc, id) => mm.calculateBroadbandStats(g, d, loc, id) }, mapManager, boundaryData, location),
		[availableBroadbandDatasets, mapManager, boundaryData, location],
	);

	if (!showBroadband) return null;

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
				Telecoms
			</h3>
			{showBroadband && (
				<BroadbandChart
					activeDataset={activeDataset}
					availableDatasets={availableBroadbandDatasets}
					aggregatedData={aggregatedBroadbandData}
					year={2025}
					selectedArea={selectedArea}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			)}
		</div>
	);
}
