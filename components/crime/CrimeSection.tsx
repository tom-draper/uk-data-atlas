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
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { useIsDark } from "@/lib/context/ThemeContext";

interface CrimeChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CrimeDataset>;
	aggregatedData: Record<number, AggregatedCrimeData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
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
	const isDark = useIsDark();
	return (
		<div
			className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}
		>
			<h3
				className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}
			>
				Crime
			</h3>
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
