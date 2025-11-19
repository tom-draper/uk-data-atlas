// components/population/density/PopulationDensity.tsx
import { memo } from "react";
import { ActiveViz, AggregatedPopulationData, PopulationDataset } from "@/lib/types";
import PopulationDensityChart from "./PopulationDensityChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { BoundaryData } from "@/lib/hooks/useBoundaryData";

interface PopulationDensityChartProps {
	dataset: PopulationDataset;
	boundaryData: BoundaryData;
	aggregatedData: AggregatedPopulationData | null;
	wardCode?: string;
	constituencyCode?: string;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper: CodeMapper;
}

function PopulationDensity({
	dataset,
	aggregatedData,
	boundaryData,
	wardCode,
	constituencyCode,
	setActiveViz,
	activeViz,
	codeMapper
}: PopulationDensityChartProps) {
	const vizId = `population-density-${dataset.year}`
	const isActive = activeViz.vizId === vizId;

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${isActive
				? 'bg-emerald-50/60 border-2 border-emerald-300'
				: 'bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300'
				}`}
			onClick={() => setActiveViz({ vizId: vizId, datasetType: dataset.type, datasetId: dataset.id })}
		>
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">Population Density ({dataset.year})</h3>
			</div>
			<PopulationDensityChart
				dataset={dataset}
				aggregatedData={aggregatedData}
				boundaryData={boundaryData}
				wardCode={wardCode}
				constituencyCode={constituencyCode}
				codeMapper={codeMapper}
			/>
		</div>
	);
}

export default memo(PopulationDensity);