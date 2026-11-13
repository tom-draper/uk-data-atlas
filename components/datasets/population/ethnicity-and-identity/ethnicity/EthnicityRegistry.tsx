"use client";
import EthnicityChart from "./EthnicityChart";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import type { AggregatedEthnicityData, EthnicityDataset } from "@/lib/types";

export function EthnicityRegistryChart(props: ChartComponentProps) {
	const dataset = props.availableDatasets[props.year] as
		EthnicityDataset | undefined;
	const aggregatedData = props.aggregatedData as Record<
		number,
		AggregatedEthnicityData
	> | null;
	return (
		<EthnicityChart
			dataset={dataset}
			aggregatedData={aggregatedData}
			selectedArea={props.selectedArea}
			codeMapper={props.codeMapper}
			activeViz={props.activeViz}
			setActiveViz={props.setActiveViz}
		/>
	);
}

export { EthnicityRegistryChart as default };
