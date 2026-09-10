"use client";

import { useMemo } from "react";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import { getChartPresentation } from "@/lib/datasets/generatedCharts";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import type { CodeMapper } from "@/lib/data/boundaries/codeMapper";
import type { DatasetAggregator } from "@/lib/helpers/datasetAggregation";
import type { ActiveViz, Dataset, Datasets, SelectedArea } from "@/lib/types";
import type { BoundaryData } from "@/lib/types/boundaries";
import type { ChartKey } from "@/lib/context/ChartVisibilityContext";
import type { ChartComponentProps } from "./chartComponentTypes";

export interface ChartCardsProps {
	group: string;
	visibility: Record<ChartKey, boolean>;
	activeDataset: Dataset | null;
	datasets: Datasets;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	aggregator: DatasetAggregator | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export function hasVisibleChart(
	group: string,
	visibility: Record<ChartKey, boolean>,
) {
	return getVisibleChartDefinitions(group, visibility).length > 0;
}

export function getVisibleChartDefinitions(
	group: string,
	visibility: Record<ChartKey, boolean>,
) {
	return CHART_DATASET_DEFINITIONS.flatMap((definition) =>
		getChartDefinitions(definition)
			.filter((chart) => chart.group === group && visibility[chart.key])
			.map((chart) => ({ definition, chart })),
	);
}

export default function ChartCards({
	group,
	visibility,
	activeDataset,
	datasets,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
	aggregator,
	boundaryData,
	location,
}: ChartCardsProps) {
	const definitions = useMemo(
		() => getVisibleChartDefinitions(group, visibility),
		[group, visibility],
	);
	const aggregatedData = useMemo(
		() =>
			Object.fromEntries(
				definitions.map(({ definition, chart }) => [
					definition.type + chart.key,
					aggregateDataset(
						{
							datasets: datasets[definition.type],
							boundaryType: definition.boundaryType,
							keyBy: chart.keyBy,
							calculateStats: chart.calculateStats,
						},
						aggregator,
						boundaryData,
						location,
					),
				]),
			),
		[definitions, datasets, aggregator, boundaryData, location],
	);

	return definitions.map(({ definition, chart }) => {
		const presentation = getChartPresentation(chart.key);
		if (!presentation) {
			console.error(`No chart presentation registered for ${chart.key}.`);
			return null;
		}
		const Chart = presentation.component;
		const props: ChartComponentProps = {
			activeDataset,
			availableDatasets: datasets[definition.type],
			aggregatedData: aggregatedData[definition.type + chart.key],
			year: chart.year,
			datasetId: chart.datasetId,
			selectedArea,
			codeMapper,
			activeViz,
			setActiveViz,
			boundaryData,
		};
		return <Chart key={chart.key} {...props} />;
	});
}
