"use client";
import PopulationDensityChart from "./density/PopulationDensityChart";
import AgeDistribution from "./age/AgeDistribution";
import Gender from "./gender/Gender";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import type { AggregatedPopulationData, PopulationDataset } from "@/lib/types";

const populationDataset = (props: ChartComponentProps) =>
	props.availableDatasets[props.year] as PopulationDataset;
const populationAggregation = (props: ChartComponentProps) =>
	props.aggregatedData as Record<number, AggregatedPopulationData> | null;

export function PopulationDensityRegistryChart(props: ChartComponentProps) {
	return (
		<PopulationDensityChart
			dataset={populationDataset(props)}
			aggregatedData={populationAggregation(props)}
			boundaryData={props.boundaryData}
			selectedArea={props.selectedArea}
			codeMapper={props.codeMapper}
			activeViz={props.activeViz}
			setActiveViz={props.setActiveViz}
		/>
	);
}

export function PopulationAgeRegistryChart(props: ChartComponentProps) {
	return (
		<AgeDistribution
			dataset={populationDataset(props)}
			aggregatedData={populationAggregation(props)}
			selectedArea={props.selectedArea}
			codeMapper={props.codeMapper}
			activeViz={props.activeViz}
			setActiveViz={props.setActiveViz}
		/>
	);
}

export function PopulationGenderRegistryChart(props: ChartComponentProps) {
	return (
		<Gender
			dataset={populationDataset(props)}
			aggregatedData={populationAggregation(props)}
			selectedArea={props.selectedArea}
			codeMapper={props.codeMapper}
			activeViz={props.activeViz}
			setActiveViz={props.setActiveViz}
		/>
	);
}
