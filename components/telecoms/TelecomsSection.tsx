"use client";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	ActiveViz,
	AggregatedBroadbandData,
	BroadbandDataset,
	Dataset,
	SelectedArea,
} from "@lib/types";
import BroadbandChart from "./broadband/BroadbandChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface TelecomsSectionProps {
	activeDataset: Dataset | null;
	availableBroadbandDatasets: Record<string, BroadbandDataset>;
	aggregatedBroadbandData: Record<number, AggregatedBroadbandData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function TelecomsSection({
	activeDataset,
	availableBroadbandDatasets,
	aggregatedBroadbandData,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
}: TelecomsSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showBroadband = visibility["telecoms-broadband"];

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
