// components/society/SocietySection.tsx
"use client";
import { memo } from "react";
import {
	ActiveViz,
	AggregatedCrimeData,
	AggregatedIMDData,
	Dataset,
	CrimeDataset,
	IMDDataset,
	SelectedArea,
} from "@lib/types";
import CrimeRateChart from "../crime/CrimeRateChart";
import IMDChart from "../imd/IMDChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface SocietySectionProps {
	activeDataset: Dataset | null;
	availableCrimeDatasets: Record<string, CrimeDataset>;
	aggregatedCrimeData: Record<number, AggregatedCrimeData> | null;
	availableIMDDatasets: Record<string, IMDDataset>;
	aggregatedIMDData: Record<number, AggregatedIMDData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default memo(function SocietySection({
	activeDataset,
	availableCrimeDatasets,
	aggregatedCrimeData,
	availableIMDDatasets,
	aggregatedIMDData,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
}: SocietySectionProps) {
	const imdYears = Object.keys(availableIMDDatasets).map(Number).sort((a, b) => b - a);

	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold pt-2">Society</h3>
			<CrimeRateChart
				activeDataset={activeDataset}
				availableDatasets={availableCrimeDatasets}
				aggregatedData={aggregatedCrimeData}
				year={2025}
				selectedArea={selectedArea}
				codeMapper={codeMapper}
				activeViz={activeViz}
				setActiveViz={setActiveViz}
			/>
			{imdYears.map((year) => (
				<IMDChart
					key={year}
					activeDataset={activeDataset}
					availableDatasets={availableIMDDatasets}
					aggregatedData={aggregatedIMDData}
					selectedArea={selectedArea}
					year={year}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			))}
		</div>
	);
});
