// components/society/SocietySection.tsx
"use client";
import { memo } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import {
	ActiveViz,
	AggregatedCrimeData,
	AggregatedIMDData,
	AggregatedLifeExpectancyData,
	Dataset,
	CrimeDataset,
	IMDDataset,
	LifeExpectancyDataset,
	SelectedArea,
} from "@lib/types";
import CrimeRateChart from "../crime/CrimeRateChart";
import IMDChart from "../imd/IMDChart";
import LifeExpectancyChart from "./LifeExpectancyChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface SocietySectionProps {
	activeDataset: Dataset | null;
	availableCrimeDatasets: Record<string, CrimeDataset>;
	aggregatedCrimeData: Record<number, AggregatedCrimeData> | null;
	availableIMDDatasets: Record<string, IMDDataset>;
	aggregatedIMDData: Record<number, AggregatedIMDData> | null;
	availableLifeExpectancyDatasets: Record<string, LifeExpectancyDataset>;
	aggregatedLifeExpectancyData: Record<number, AggregatedLifeExpectancyData> | null;
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
	availableLifeExpectancyDatasets,
	aggregatedLifeExpectancyData,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
}: SocietySectionProps) {
	const { visibility } = useChartVisibility();
	const showCrime = visibility["society-crime"];
	const showIMD = visibility["society-imd"];
	const showLE = visibility["society-lifeExpectancy"];
	const showHLE = visibility["society-healthyLifeExpectancy"];

	const imdYears = Object.keys(availableIMDDatasets).map(Number).sort((a, b) => b - a);
	const leIds = Object.keys(availableLifeExpectancyDatasets).sort();

	if (!showCrime && !showIMD && !showLE && !showHLE) return null;

	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold pt-2">Society</h3>
			{showCrime && (
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
			)}
			{showIMD && imdYears.map((year) => (
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
			{leIds.filter((id) => id === "le" ? showLE : id === "hle" ? showHLE : true).map((id) => (
				<LifeExpectancyChart
					key={id}
					activeDataset={activeDataset}
					availableDatasets={availableLifeExpectancyDatasets}
					aggregatedData={aggregatedLifeExpectancyData}
					selectedArea={selectedArea}
					datasetId={id}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			))}
		</div>
	);
});
