// components/PopulationChart.tsx
"use client";
import {
	ActiveViz,
	AggregatedEthnicityData,
	AggregatedPopulationData,
	BoundaryData,
	EthnicityDataset,
	PopulationDataset,
	SelectedArea,
} from "@lib/types";
import Gender from "./gender/Gender";
import AgeDistribution from "./age/AgeDistribution";
import PopulationDensity from "./density/PopulationDensity";
import EthnicityChart from "./ethnicity/EthnicityChart";

export interface DemographicsChartSectionProps {
	availablePopulationDatasets: Record<string, PopulationDataset>;
	aggregatedPopulationData: AggregatedPopulationData | null;
	availableEthnicityDatasets: Record<string, EthnicityDataset>;
	aggregatedEthnicityData: AggregatedEthnicityData | null;
	boundaryData: BoundaryData;
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

export default function DemographicsChartSection({
	availablePopulationDatasets,
	aggregatedPopulationData,
	availableEthnicityDatasets,
	aggregatedEthnicityData,
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
					dataset={availablePopulationDatasets[2022]}
					aggregatedData={aggregatedPopulationData}
					boundaryData={boundaryData}
					selectedArea={selectedArea}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
				<AgeDistribution
					dataset={availablePopulationDatasets[2022]}
					aggregatedData={aggregatedPopulationData}
					selectedArea={selectedArea}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
				<Gender
					dataset={availablePopulationDatasets[2022]}
					aggregatedData={aggregatedPopulationData}
					selectedArea={selectedArea}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
				<EthnicityChart
					dataset={availableEthnicityDatasets[2021]}
					aggregatedData={aggregatedEthnicityData}
					selectedArea={selectedArea}
					codeMapper={codeMapper}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
				/>
			</div>
		</div>
	);
}
