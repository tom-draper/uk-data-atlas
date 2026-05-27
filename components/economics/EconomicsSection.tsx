// components/HousePriceChart.tsx
"use client";
import { memo } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	ActiveViz,
	AggregatedHousePriceData,
	AggregatedIncomeData,
	Dataset,
	HousePriceDataset,
	IncomeDataset,
	SelectedArea,
} from "@lib/types";
import HousePriceChart from "./house-price/HousePriceChart";
import IncomeChart from "./income/IncomeChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface EconomicsSectionProps {
	activeDataset: Dataset | null;
	availableHousePriceDatasets: Record<string, HousePriceDataset>;
	aggregatedHousePriceData: Record<number, AggregatedHousePriceData> | null;
	availableIncomeDatasets: Record<string, IncomeDataset>;
	aggregatedIncomeData: Record<number, AggregatedIncomeData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default memo(function EconomicsSection({
	activeDataset,
	availableHousePriceDatasets,
	aggregatedHousePriceData,
	availableIncomeDatasets,
	aggregatedIncomeData,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
}: EconomicsSectionProps) {
	const { visibility } = useChartVisibility();
	const isDark = useIsDark();
	const showHousePrice = visibility["economics-housePrice"];
	const showIncome = visibility["economics-income"];

	if (!showHousePrice && !showIncome) return null;

	return (
		<div
			className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}
		>
			<h3
				className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}
			>
				Economics
			</h3>
			{showHousePrice && (
				<HousePriceChart
					activeDataset={activeDataset}
					availableDatasets={availableHousePriceDatasets}
					aggregatedData={aggregatedHousePriceData}
					year={2023}
					selectedArea={selectedArea}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			)}
			{showIncome && (
				<IncomeChart
					activeDataset={activeDataset}
					availableDatasets={availableIncomeDatasets}
					aggregatedData={aggregatedIncomeData}
					year={2025}
					selectedArea={selectedArea}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			)}
		</div>
	);
});
