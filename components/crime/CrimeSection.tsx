// components/crime/CrimeChart.tsx
"use client";
import {
	ActiveViz,
	AggregatedCrimeData,
	Dataset,
	CrimeDataset,
	SelectedArea,
} from "@lib/types";
import CrimeChart from "./CrimeRateChart";

interface CrimeChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CrimeDataset>;
	aggregatedData: Record<number, AggregatedCrimeData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: {
		getCodeForYear: (
			type: "localAuthority",
			code: string,
			targetYear: number,
		) => string | undefined;
	};
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function CrimeSection({
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
}
