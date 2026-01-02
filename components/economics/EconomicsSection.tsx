// components/HousePriceChart.tsx
"use client";
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

interface EconomicsSectionProps {
	activeDataset: Dataset | null;
	availableHousePriceDatasets: Record<string, HousePriceDataset>;
	aggregatedHousePriceData: Record<number, AggregatedHousePriceData> | null;
	availableIncomeDatasets: Record<string, IncomeDataset>;
	aggregatedIncomeData: Record<number, AggregatedIncomeData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: {
		getCodeForYear: (
			type: "ward" | "localAuthority",
			code: string,
			targetYear: number,
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function EconomicsSection({
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
	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold pt-2">Economics</h3>
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
		</div>
	);
}
