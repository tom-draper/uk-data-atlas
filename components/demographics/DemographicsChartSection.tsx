// components/PopulationChart.tsx
"use client";
import {
	ActiveViz,
	AggregatedPopulationData,
	PopulationDataset,
	SelectedArea,
} from "@lib/types";
import { BoundaryData } from "@/lib/hooks/useBoundaryData";
import Gender from "./gender/Gender";
import AgeDistribution from "./age/AgeDistribution";
import PopulationDensity from "./density/PopulationDensity";

export interface DemographicsChartSectionProps {
	availableDatasets: Record<string, PopulationDataset>;
	aggregatedData: AggregatedPopulationData | null;
	boundaryData: BoundaryData;
	selectedArea: SelectedArea | null;
	codeMapper?: {
		getCodeForYear: (
			type: "ward",
			code: string,
			targetYear: number
		) => string | undefined;
	};
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default function DemographicsChartSection({
	availableDatasets,
	aggregatedData,
	boundaryData,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
}: DemographicsChartSectionProps) {
	return (
		<div className="pt-2.5 border-t border-gray-200/80">
			<h3 className="text-xs font-bold mb-2">Demographics</h3>
			<div className="space-y-3">
				<PopulationDensity
					dataset={availableDatasets[2022]}
					aggregatedData={aggregatedData}
					boundaryData={boundaryData}
					selectedArea={selectedArea}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
				<AgeDistribution
					dataset={availableDatasets[2022]}
					aggregatedData={aggregatedData}
					selectedArea={selectedArea}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
				<Gender
					dataset={availableDatasets[2022]}
					aggregatedData={aggregatedData}
					selectedArea={selectedArea}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			</div>
		</div>
	);
}
