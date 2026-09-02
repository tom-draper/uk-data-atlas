"use client";

import { useMemo } from "react";
import { SCALAR_DATASET_DEFINITIONS } from "@/lib/datasets";
import { SCALAR_CHART_COMPONENTS } from "@/lib/datasets/generatedCharts";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";
import type { CodeMapper } from "@/lib/hooks/useCodeMapper";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import type { ActiveViz, Dataset, Datasets, SelectedArea } from "@/lib/types";
import type { BoundaryData } from "@/lib/types/boundaries";
import type { ChartKey } from "@/lib/context/ChartVisibilityContext";

interface ScalarChartCardsProps {
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

export function hasVisibleScalarChart(
	group: string,
	visibility: Record<ChartKey, boolean>,
) {
	return SCALAR_DATASET_DEFINITIONS.some(
		(definition) => definition.chart.group === group && visibility[definition.chart.key],
	);
}

export default function ScalarChartCards({ group, visibility, activeDataset, datasets, selectedArea, codeMapper, activeViz, setActiveViz, mapManager, boundaryData, location }: ScalarChartCardsProps) {
	const definitions = SCALAR_DATASET_DEFINITIONS.filter((definition) => definition.chart.group === group);
	const aggregatedData = useMemo(
		() => Object.fromEntries(definitions.map((definition) => [definition.type, aggregateDataset<any>({ datasets: datasets[definition.type], boundaryType: definition.chart.boundaryType, calculateStats: definition.chart.calculateStats }, mapManager, boundaryData, location)])),
		[mapManager, boundaryData, location, ...definitions.map((definition) => datasets[definition.type])],
	);

	return definitions.map((definition) => {
		if (!visibility[definition.chart.key]) return null;
		const Chart = SCALAR_CHART_COMPONENTS[definition.type];
		return <Chart key={definition.type} activeDataset={activeDataset} availableDatasets={datasets[definition.type]} aggregatedData={aggregatedData[definition.type]} year={definition.chart.year} selectedArea={selectedArea} codeMapper={codeMapper} activeViz={activeViz} setActiveViz={setActiveViz} />;
	});
}
