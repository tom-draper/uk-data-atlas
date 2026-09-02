"use client";

import { useMemo } from "react";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import { CHART_COMPONENTS } from "@/lib/datasets/generatedCharts";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import type { CodeMapper } from "@/lib/hooks/useCodeMapper";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import type { ActiveViz, Dataset, Datasets, SelectedArea } from "@/lib/types";
import type { BoundaryData } from "@/lib/types/boundaries";
import type { ChartKey } from "@/lib/context/ChartVisibilityContext";

interface ChartCardsProps {
	group: string;
	visibility: Record<ChartKey, boolean>;
	activeDataset: Dataset | null;
	datasets: Datasets;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	mapManager: MapManager | null;
	boundaryData: BoundaryData;
	location: string | null;
}

export function hasVisibleChart(
	group: string,
	visibility: Record<ChartKey, boolean>,
) {
	return CHART_DATASET_DEFINITIONS.some((definition) => getChartDefinitions(definition).some((chart) => chart.group === group && visibility[chart.key]));
}

export default function ChartCards({ group, visibility, activeDataset, datasets, selectedArea, codeMapper, activeViz, setActiveViz, mapManager, boundaryData, location }: ChartCardsProps) {
	const definitions = CHART_DATASET_DEFINITIONS.flatMap((definition) => getChartDefinitions(definition).filter((chart) => chart.group === group).map((chart) => ({ definition, chart })));
	const aggregatedData = useMemo(
		() => Object.fromEntries(definitions.map(({ definition, chart }) => [definition.type + chart.key, aggregateDataset<any>({ datasets: datasets[definition.type], boundaryType: chart.boundaryType, keyBy: chart.keyBy, calculateStats: chart.calculateStats }, mapManager, boundaryData, location)])),
		[mapManager, boundaryData, location, ...definitions.map(({ definition }) => datasets[definition.type])],
	);

	return definitions.map(({ definition, chart }) => {
		if (!visibility[chart.key]) return null;
		const Chart = CHART_COMPONENTS[chart.key];
		return <Chart key={chart.key} activeDataset={activeDataset} availableDatasets={datasets[definition.type]} aggregatedData={aggregatedData[definition.type + chart.key]} year={chart.year} datasetId={chart.datasetId} selectedArea={selectedArea} codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} boundaryData={boundaryData} />;
	});
}
