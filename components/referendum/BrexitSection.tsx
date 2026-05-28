// components/referendum/BrexitSection.tsx
"use client";

import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	ActiveViz,
	AggregatedBrexitData,
	Dataset,
	BrexitLADDataset,
	BrexitConstituencyDataset,
	SelectedArea,
} from "@lib/types";
import BrexitHanrettyEstimatesChart from "./BrexitHanrettyEstimatesChart";
import BrexitElectoralChart from "./BrexitElectoralChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface BrexitSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, BrexitLADDataset>;
	availableConstituencyDatasets: Record<string, BrexitConstituencyDataset>;
	aggregatedData: Record<number, AggregatedBrexitData> | null;
	aggregatedConstituencyData: Record<number, AggregatedBrexitData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function BrexitSection({
	activeDataset,
	availableDatasets,
	availableConstituencyDatasets,
	aggregatedData,
	aggregatedConstituencyData,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
}: BrexitSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showHanretty = visibility["brexit-hanretty"];
	const showElectoral = visibility["brexit-electoral"];

	if (!showHanretty && !showElectoral) return null;

	return (
		<div
			className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}
		>
			<h3
				className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}
			>
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
