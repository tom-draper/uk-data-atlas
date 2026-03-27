// components/referendum/BrexitSection.tsx
"use client";
import { memo } from "react";
import {
	ActiveViz,
	AggregatedBrexitData,
	Dataset,
	BrexitDataset,
	BrexitConstituencyDataset,
	SelectedArea,
} from "@lib/types";
import BrexitChart from "./BrexitChart";
import BrexitConstituencyChart from "./BrexitConstituencyChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface BrexitSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, BrexitDataset>;
	availableConstituencyDatasets: Record<string, BrexitConstituencyDataset>;
	aggregatedData: Record<number, AggregatedBrexitData> | null;
	aggregatedConstituencyData: Record<number, AggregatedBrexitData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default memo(function BrexitSection({
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
	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold pt-2">Brexit</h3>
			<BrexitChart
				activeDataset={activeDataset}
				availableDatasets={availableDatasets}
				aggregatedData={aggregatedData}
				year={2016}
				selectedArea={selectedArea}
				codeMapper={codeMapper}
				activeViz={activeViz}
				setActiveViz={setActiveViz}
			/>
			<BrexitConstituencyChart
				activeDataset={activeDataset}
				availableDatasets={availableConstituencyDatasets}
				aggregatedData={aggregatedConstituencyData}
				year={2016}
				selectedArea={selectedArea}
				codeMapper={codeMapper}
				activeViz={activeViz}
				setActiveViz={setActiveViz}
			/>
		</div>
	);
});
