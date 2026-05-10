// components/PopulationChart.tsx
"use client";
import { memo } from "react";
import { useChartVisibility } from "@/lib/context/ChartVisibilityContext";
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
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

export interface DemographicsChartSectionProps {
	availablePopulationDatasets: Record<string, PopulationDataset>;
	aggregatedPopulationData: Record<number, AggregatedPopulationData> | null;
	availableEthnicityDatasets: Record<string, EthnicityDataset>;
	aggregatedEthnicityData: Record<number, AggregatedEthnicityData> | null;
	boundaryData: BoundaryData;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

export default memo(function DemographicsChartSection({
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
	const { visibility } = useChartVisibility();
	const showDensity = visibility["demographics-populationDensity"];
	const showAge = visibility["demographics-age"];
	const showGender = visibility["demographics-gender"];
	const showEthnicity = visibility["demographics-ethnicity"];

	if (!showDensity && !showAge && !showGender && !showEthnicity) return null;

	return (
		<div className="pt-2.5 border-t border-gray-200/80">
			<h3 className="text-xs font-bold mb-2">Demographics</h3>
			<div className="space-y-3">
				{showDensity && (
					<PopulationDensity
						dataset={availablePopulationDatasets[2022]}
						aggregatedData={aggregatedPopulationData}
						boundaryData={boundaryData}
						selectedArea={selectedArea}
						codeMapper={codeMapper}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
					/>
				)}
				{showAge && (
					<AgeDistribution
						dataset={availablePopulationDatasets[2022]}
						aggregatedData={aggregatedPopulationData}
						selectedArea={selectedArea}
						codeMapper={codeMapper}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
					/>
				)}
				{showGender && (
					<Gender
						dataset={availablePopulationDatasets[2022]}
						aggregatedData={aggregatedPopulationData}
						selectedArea={selectedArea}
						codeMapper={codeMapper}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
					/>
				)}
				{showEthnicity && (
					<EthnicityChart
						dataset={availableEthnicityDatasets[2021]}
						aggregatedData={aggregatedEthnicityData}
						selectedArea={selectedArea}
						codeMapper={codeMapper}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
					/>
				)}
			</div>
		</div>
	);
});
