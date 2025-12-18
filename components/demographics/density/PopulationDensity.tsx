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

interface PopulationDensityChartProps {
	dataset: PopulationDataset;
	boundaryData: BoundaryData;
	aggregatedData: AggregatedPopulationData | null;
	selectedArea: SelectedArea | null;
	codeMapper?: {
		getCodeForYear: (
			type: "ward",
			code: string,
			targetYear: number
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
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
	const vizId = `populationDensity${dataset.year}`;
	const isActive = activeViz.vizId === vizId;

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${isActive
					? "bg-emerald-50/60 border-2 border-emerald-300"
					: "bg-white/60 border-2 border-gray-200/80 hover:border-emerald-300"
				}`}
			onClick={() =>
				setActiveViz({
					vizId: vizId,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
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
