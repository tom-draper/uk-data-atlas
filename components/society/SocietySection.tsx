// components/society/SocietySection.tsx
"use client";
import { memo } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	ActiveViz,
	AggregatedCrimeData,
	AggregatedIMDData,
	AggregatedSIMDData,
	AggregatedWIMDData,
	AggregatedLifeExpectancyData,
	Dataset,
	CrimeDataset,
	IMDDataset,
	SIMDDataset,
	WIMDDataset,
	LifeExpectancyDataset,
	SelectedArea,
} from "@lib/types";
import CrimeRateChart from "../crime/CrimeRateChart";
import IMDChart from "../imd/IMDChart";
import SIMDChart from "../simd/SIMDChart";
import WIMDChart from "../wimd/WIMDChart";
import LifeExpectancyChart from "./LifeExpectancyChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface SocietySectionProps {
	activeDataset: Dataset | null;
	availableCrimeDatasets: Record<string, CrimeDataset>;
	aggregatedCrimeData: Record<number, AggregatedCrimeData> | null;
	availableIMDDatasets: Record<string, IMDDataset>;
	aggregatedIMDData: Record<number, AggregatedIMDData> | null;
	availableSIMDDatasets: Record<string, SIMDDataset>;
	aggregatedSIMDData: Record<number, AggregatedSIMDData> | null;
	availableWIMDDatasets: Record<string, WIMDDataset>;
	aggregatedWIMDData: Record<number, AggregatedWIMDData> | null;
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
	availableSIMDDatasets,
	aggregatedSIMDData,
	availableWIMDDatasets,
	aggregatedWIMDData,
	availableLifeExpectancyDatasets,
	aggregatedLifeExpectancyData,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
}: SocietySectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showCrime = visibility["society-crime"];
	const showIMD = visibility["society-imd"];
	const showSIMD = visibility["society-simd"];
	const showWIMD = visibility["society-wimd"];
	const showLE = visibility["society-lifeExpectancy"];
	const showHLE = visibility["society-healthyLifeExpectancy"];

	const imdYears = Object.keys(availableIMDDatasets).map(Number).sort((a, b) => b - a);
	const simdYears = Object.keys(availableSIMDDatasets).map(Number).sort((a, b) => b - a);
	const wimdYears = Object.keys(availableWIMDDatasets).map(Number).sort((a, b) => b - a);
	const leIds = Object.keys(availableLifeExpectancyDatasets).sort();

	if (!showCrime && !showIMD && !showSIMD && !showWIMD && !showLE && !showHLE) return null;

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>Society</h3>
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
			{showSIMD && simdYears.map((year) => (
				<SIMDChart
					key={year}
					activeDataset={activeDataset}
					availableDatasets={availableSIMDDatasets}
					aggregatedData={aggregatedSIMDData}
					selectedArea={selectedArea}
					year={year}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			))}
			{showWIMD && wimdYears.map((year) => (
				<WIMDChart
					key={year}
					activeDataset={activeDataset}
					availableDatasets={availableWIMDDatasets}
					aggregatedData={aggregatedWIMDData}
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
