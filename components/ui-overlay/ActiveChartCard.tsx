"use client";

import { useMemo } from "react";
import ChartCards from "@components/ChartCards";
import { ChartLoadingProvider } from "@components/ChartLoadingPlaceholder";
import TransportCards from "@components/transport/TransportCards";
import { CustomDatasetCard } from "@components/custom/CustomDatasetCard";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import { getChartDefinitions } from "@/lib/datasets/types";
import type {
	ActiveViz,
	BoundaryData,
	Dataset,
	Datasets,
	SelectedArea,
} from "@lib/types";
import type { CustomDataset } from "@/lib/types/custom";
import type { NetworkDataset } from "@/lib/types/network";
import type { CodeMapper } from "@/lib/data/boundaries/codeMapper";
import type { MapManager } from "@/lib/helpers/mapManager/mapManager";

interface ActiveChartCardProps {
	datasets: Datasets;
	customDatasets: CustomDataset[];
	roadSafetyDatasets: CustomDataset[];
	networkDatasets: NetworkDataset[];
	activeDataset: Dataset | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	chartsLoading: boolean;
	selectedArea: SelectedArea | null;
	boundaryData: BoundaryData;
	codeMapper?: CodeMapper;
	mapManager: MapManager | null;
	location: string;
}

/**
 * The card of the dataset on the map, on its own, for the mobile layout.
 *
 * A chart component can draw several cards from one dataset, such as the
 * population's density, age and gender, and decides for itself which of them
 * is active. So every chart of the active dataset is rendered and the cards
 * that are not active are hidden.
 */
export default function ActiveChartCard({
	datasets,
	customDatasets,
	roadSafetyDatasets,
	networkDatasets,
	activeDataset,
	activeViz,
	setActiveViz,
	chartsLoading,
	selectedArea,
	boundaryData,
	codeMapper,
	mapManager,
	location,
}: ActiveChartCardProps) {
	const charts = useMemo(
		() =>
			CHART_DATASET_DEFINITIONS.filter(
				(definition) => definition.type === activeViz.datasetType,
			).flatMap((definition) => getChartDefinitions(definition)),
		[activeViz.datasetType],
	);
	const groups = [...new Set(charts.map((chart) => chart.group))];
	const visibility = useMemo(
		() => Object.fromEntries(charts.map((chart) => [chart.key, true])),
		[charts],
	);
	const customDataset = customDatasets.find(
		(dataset) =>
			activeViz.datasetType === "custom" &&
			dataset.id === activeViz.datasetId,
	);
	const isTransport =
		activeViz.datasetType === "network" ||
		roadSafetyDatasets.some(
			(dataset) =>
				activeViz.datasetType === "custom" &&
				dataset.id === activeViz.datasetId,
		);

	return (
		<div className="[&_[data-active=false]]:hidden">
			<ChartLoadingProvider loading={chartsLoading}>
				{groups.map((group) => (
					<ChartCards
						key={group}
						group={group}
						visibility={visibility}
						activeDataset={activeDataset}
						datasets={datasets}
						selectedArea={selectedArea}
						codeMapper={codeMapper}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
						aggregator={mapManager?.datasetAggregator ?? null}
						boundaryData={boundaryData}
						location={location}
					/>
				))}
				{isTransport && (
					<TransportCards
						roadSafetyDatasets={roadSafetyDatasets}
						networkDatasets={networkDatasets}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
						location={location}
						mapManager={mapManager}
					/>
				)}
				{customDataset && codeMapper && (
					<CustomDatasetCard
						customDataset={customDataset}
						selectedArea={selectedArea}
						isActive
						setActiveViz={setActiveViz}
						codeMapper={codeMapper}
						mapManager={mapManager}
						boundaryData={boundaryData}
						location={location}
					/>
				)}
			</ChartLoadingProvider>
		</div>
	);
}
