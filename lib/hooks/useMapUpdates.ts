import { useEffect } from "react";
import { ActiveViz, BoundaryGeojson, Dataset } from "@lib/types";
import type { MapManager } from "../helpers/mapManager";
import { MapOptions } from "../types/mapOptions";
import { useIsDark } from "../context/ThemeContext";
import { gazetteer } from "../data/gazetteer/static";
import { getChartDatasetDefinition, isChartDataset } from "../datasets";
import { categoryFilter } from "../helpers/mapManager/expressions";
import {
	renderCustomDataset,
	renderCustomPoints,
	renderNumericDataset,
} from "@/lib/helpers/mapRendering";

/** Builds the vector-tile filter driven by the roads legend's click-to-isolate / right-click-to-exclude state. */
function buildNetworkFilter(
	layer: NonNullable<Extract<Dataset, { type: "network" }>["layer"]>,
	legend: Extract<Dataset, { type: "network" }>["legend"],
	network: MapOptions["network"],
) {
	if (!legend || !layer.filterProperty) return undefined;
	const allIds = legend.map((item) => item.id);
	const { selected, excluded = [] } = network;
	const activeIds = new Set(
		selected ? [selected] : allIds.filter((id) => !excluded.includes(id)),
	);
	return categoryFilter(layer.filterProperty, legend, activeIds);
}

interface UseMapUpdatesParams {
	geojson: BoundaryGeojson | null;
	activeViz: ActiveViz;
	activeDataset: Dataset | null;
	mapManager: MapManager | null;
	mapOptions: MapOptions;
	styleReady: boolean;
	selectedLocation: string;
}

function getActiveDataOptions(
	activeDataset: Dataset | null,
	activeViz: ActiveViz,
	mapOptions: MapOptions,
): object | null {
	if (!activeDataset) return null;
	if (isChartDataset(activeDataset)) {
		const definition = getChartDatasetDefinition(activeDataset.type);
		if (definition?.mapRenderer) {
			return definition.mapRenderer.getOptions(activeViz, mapOptions);
		}
		return definition?.map ? mapOptions[activeDataset.type] : null;
	}

	switch (activeDataset.type) {
		case "network":
			return null;
		case "custom":
			return mapOptions.custom;
	}
}

export function useMapUpdates({
	geojson,
	activeViz,
	activeDataset,
	mapManager,
	mapOptions,
	styleReady,
	selectedLocation,
}: UseMapUpdatesParams) {
	const isDark = useIsDark();
	const activeDataOptions = getActiveDataOptions(
		activeDataset,
		activeViz,
		mapOptions,
	);

	useEffect(() => {
		if (!mapManager || !styleReady) return;
		mapManager.updateVisibility(mapOptions.visibility);
		mapManager.setBorderVisibility(mapOptions.visibility.hideBorders);
	}, [mapManager, styleReady, mapOptions.visibility]);

	useEffect(() => {
		if (!mapManager || !styleReady) return;
		if (activeDataset?.type === "network") {
			if (activeDataset.layer) {
				mapManager.updateVectorLineLayer({
					...activeDataset.layer,
					visibility: mapOptions.visibility,
					filter: buildNetworkFilter(
						activeDataset.layer,
						activeDataset.legend,
						mapOptions.network,
					),
				});
			} else {
				mapManager.clearMapDataLayers();
			}
		} else {
			mapManager.clearVectorLineLayer("os-open-roads");
		}
	}, [
		activeDataset,
		mapManager,
		styleReady,
		mapOptions.visibility,
		mapOptions.network,
	]);

	// Custom point datasets (coordinates / postcodes) render on their own
	// source/layer and don't need a boundary geojson, so they live in a
	// separate effect. Clear the point layer whenever a non-point viz is active.
	useEffect(() => {
		if (!mapManager || !styleReady) return;
		if (
			activeDataset?.type === "custom" &&
			activeDataset.kind === "points"
		) {
			renderCustomPoints(
				mapManager,
				activeDataset,
				mapOptions,
				gazetteer.boundsOf(selectedLocation) ?? null,
				isDark,
			);
		} else {
			mapManager.clearCustomPoints();
		}
	}, [
		activeDataset,
		mapManager,
		mapOptions.custom,
		mapOptions.theme.id,
		mapOptions.visibility,
		isDark,
		styleReady,
		selectedLocation,
	]);

	useEffect(() => {
		if (!geojson || !activeDataset || !mapManager) return;
		if (activeDataset.type === "network") return;
		// Point datasets are drawn by the effect above and carry no per-boundary
		// values (`data` is empty), so the choropleth path below would repaint
		// every boundary in the default colour — undoing the clearBoundaryData()
		// that renderCustomPoints() just did — and rebind the hover
		// handlers to an empty record. Effects run in declaration order, so this
		// one always wins; skip it instead.
		if (activeDataset.type === "custom" && activeDataset.kind === "points")
			return;

		const performUpdate = () => {
			if (isChartDataset(activeDataset)) {
				const definition = getChartDatasetDefinition(
					activeDataset.type,
				);
				if (definition?.mapRenderer) {
					return definition.mapRenderer.render({
						map: mapManager,
						geojson,
						dataset: activeDataset,
						mapOptions,
						activeViz,
						isDark,
					});
				}
				if (definition?.map) {
					return renderNumericDataset(
						mapManager,
						geojson,
						activeDataset,
						mapOptions,
						definition.map,
					);
				}
			}

			switch (activeDataset.type) {
				case "custom":
					return renderCustomDataset(
						mapManager,
						geojson,
						activeDataset,
						mapOptions,
					);
			}
		};

		performUpdate();
	}, [
		geojson,
		activeDataset,
		activeViz,
		mapManager,
		activeDataOptions,
		mapOptions.theme.id,
		styleReady,
		isDark,
	]);
}
