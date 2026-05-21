// components/population/density/PopulationDensity.tsx
import { memo } from "react";
import {
	ActiveViz,
	AggregatedPopulationData,
	BoundaryData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";
import PopulationDensityChart from "./PopulationDensityChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { ChartLoadingBackground } from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";

interface PopulationDensityChartProps {
	dataset: PopulationDataset;
	boundaryData: BoundaryData;
	aggregatedData: Record<number, AggregatedPopulationData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

function PopulationDensity({
	dataset,
	aggregatedData,
	boundaryData,
	selectedArea,
	codeMapper,
	setActiveViz,
	activeViz,
}: PopulationDensityChartProps) {
	const isDark = useIsDark();
	const vizId = `populationDensity${dataset.year}`;
	const isActive = activeViz.vizId === vizId;

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer overflow-hidden relative ${isActive
					? `border-2 border-emerald-300 ${isDark ? "bg-white/10" : "bg-emerald-50/60"}`
					: isDark ? "bg-white/5 border-2 border-white/10 hover:border-emerald-300" : "bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300"
				}`}
			title="Office for National Statistics. Census 2021: Population Density, England and Wales. ons.gov.uk"
			onClick={() =>
				setActiveViz({
					vizId: vizId,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartLoadingBackground />
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">
					Population Density [{dataset.year}]
				</h3>
			</div>
			<PopulationDensityChart
				dataset={dataset}
				aggregatedData={aggregatedData}
				boundaryData={boundaryData}
				selectedArea={selectedArea}
				codeMapper={codeMapper}
			/>
			</div>
	);
}

export default memo(PopulationDensity);
