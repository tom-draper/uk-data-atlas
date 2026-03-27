// components/imd/IMDSection.tsx
"use client";
import { memo } from "react";
import {
	ActiveViz,
	AggregatedIMDData,
	Dataset,
	IMDDataset,
	SelectedArea,
} from "@lib/types";
import IMDChart from "./IMDChart";

interface IMDSectionProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, IMDDataset>;
	aggregatedData: Record<number, AggregatedIMDData> | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default memo(function IMDSection({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	activeViz,
	setActiveViz,
}: IMDSectionProps) {
	const years = Object.keys(availableDatasets).map(Number).sort((a, b) => b - a);

	if (years.length === 0) return null;

	return (
		<div className="space-y-2">
			{years.map((year) => (
				<IMDChart
					key={year}
					activeDataset={activeDataset}
					availableDatasets={availableDatasets}
					aggregatedData={aggregatedData}
					selectedArea={selectedArea}
					year={year}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			))}
		</div>
	);
});
