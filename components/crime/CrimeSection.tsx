// components/crime/CrimeChart.tsx
"use client";
import { memo } from "react";
import {
	ActiveViz,
	AggregatedCrimeData,
	Dataset,
	CrimeDataset,
	SelectedArea,
} from "@lib/types";
import CrimeChart from "./CrimeRateChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface CrimeChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CrimeDataset>;
	aggregatedData: Record<number, AggregatedCrimeData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default memo(function CrimeSection({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
}: CrimeChartProps) {
	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold pt-2">Crime</h3>
			<CrimeChart
				activeDataset={activeDataset}
				availableDatasets={availableDatasets}
				aggregatedData={aggregatedData}
				year={2025}
				selectedArea={selectedArea}
				codeMapper={codeMapper}
				activeViz={activeViz}
				setActiveViz={setActiveViz}
			/>
		</div>
	);
});
