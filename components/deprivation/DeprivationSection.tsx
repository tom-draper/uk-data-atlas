"use client";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	ActiveViz,
	AggregatedIMDData,
	AggregatedSIMDData,
	AggregatedWIMDData,
	AggregatedNIMDMData,
	Dataset,
	IMDDataset,
	SIMDDataset,
	WIMDDataset,
	NIMDMDataset,
	SelectedArea,
} from "@lib/types";
import IMDChart from "./imd/IMDChart";
import SIMDChart from "./simd/SIMDChart";
import WIMDChart from "./wimd/WIMDChart";
import NIMDMChart from "./nimdm/NIMDMChart";

interface DeprivationSectionProps {
	activeDataset: Dataset | null;
	availableIMDDatasets: Record<string, IMDDataset>;
	aggregatedIMDData: Record<number, AggregatedIMDData> | null;
	availableSIMDDatasets: Record<string, SIMDDataset>;
	aggregatedSIMDData: Record<number, AggregatedSIMDData> | null;
	availableWIMDDatasets: Record<string, WIMDDataset>;
	aggregatedWIMDData: Record<number, AggregatedWIMDData> | null;
	availableNIMDMDatasets: Record<string, NIMDMDataset>;
	aggregatedNIMDMData: Record<number, AggregatedNIMDMData> | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function DeprivationSection({
	activeDataset,
	availableIMDDatasets,
	aggregatedIMDData,
	availableSIMDDatasets,
	aggregatedSIMDData,
	availableWIMDDatasets,
	aggregatedWIMDData,
	availableNIMDMDatasets,
	aggregatedNIMDMData,
	selectedArea,
	activeViz,
	setActiveViz,
}: DeprivationSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showIMD = visibility["deprivation-imd"];
	const showSIMD = visibility["deprivation-simd"];
	const showWIMD = visibility["deprivation-wimd"];
	const showNIMDM = visibility["deprivation-nimdm"];

	if (!showIMD && !showSIMD && !showWIMD && !showNIMDM) return null;

	const imdYears = Object.keys(availableIMDDatasets).map(Number).sort((a, b) => b - a);
	const simdYears = Object.keys(availableSIMDDatasets).map(Number).sort((a, b) => b - a);
	const wimdYears = Object.keys(availableWIMDDatasets).map(Number).sort((a, b) => b - a);
	const nimdmYears = Object.keys(availableNIMDMDatasets).map(Number).sort((a, b) => b - a);

	return (
		<div className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}>
			<h3 className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
				Deprivation
			</h3>
			{showIMD && imdYears.map((year) => (
				<IMDChart key={year} activeDataset={activeDataset} availableDatasets={availableIMDDatasets}
					aggregatedData={aggregatedIMDData} selectedArea={selectedArea} year={year}
					activeViz={activeViz} setActiveViz={setActiveViz} />
			))}
			{showSIMD && simdYears.map((year) => (
				<SIMDChart key={year} activeDataset={activeDataset} availableDatasets={availableSIMDDatasets}
					aggregatedData={aggregatedSIMDData} selectedArea={selectedArea} year={year}
					activeViz={activeViz} setActiveViz={setActiveViz} />
			))}
			{showWIMD && wimdYears.map((year) => (
				<WIMDChart key={year} activeDataset={activeDataset} availableDatasets={availableWIMDDatasets}
					aggregatedData={aggregatedWIMDData} selectedArea={selectedArea} year={year}
					activeViz={activeViz} setActiveViz={setActiveViz} />
			))}
			{showNIMDM && nimdmYears.map((year) => (
				<NIMDMChart key={year} activeDataset={activeDataset} availableDatasets={availableNIMDMDatasets}
					aggregatedData={aggregatedNIMDMData} selectedArea={selectedArea} year={year}
					activeViz={activeViz} setActiveViz={setActiveViz} />
			))}
		</div>
	);
}
