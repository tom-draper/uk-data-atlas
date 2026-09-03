import { useEffect } from "react";
import { ActiveViz, BoundaryGeojson, BoundaryData, Dataset } from "@lib/types";
import type { MapManager } from "../helpers/mapManager";
import { MapOptions } from "../types/mapOptions";
import { useIsDark } from "../context/ThemeContext";
import { gazetteer } from "../data/gazetteer/static";
import { isChartDataset } from "../datasets";
import {
	allFilters,
	categoryFilter,
	withinFilter,
	type MapExpression,
} from "../helpers/mapManager/expressions";

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

const signedRingArea = (ring: number[][]): number => {
	let area = 0;
	for (let i = 0; i < ring.length - 1; i++) {
		const [x1, y1] = ring[i];
		const [x2, y2] = ring[i + 1];
		area += x1 * y2 - x2 * y1;
	}
	return area / 2;
};

/**
 * `topojson-client` preserves TopoJSON's own ring-winding convention
 * (clockwise exterior rings), which is the reverse of the GeoJSON RFC 7946
 * rule (counter-clockwise exterior, clockwise holes) that MapLibre's `within`
 * expression relies on to tell inside from outside. Re-wind each ring so
 * `within` sees a correctly oriented polygon.
 */
const withRfc7946Winding = (polygon: number[][][]): number[][][] =>
	polygon.map((ring, index) => {
		const isCounterClockwise = signedRingArea(ring) > 0;
		const shouldBeCounterClockwise = index === 0; // exterior ring CCW, holes CW
		return isCounterClockwise === shouldBeCounterClockwise ? ring : [...ring].reverse();
	});

/**
 * Restricts the roads layer to the currently selected location by combining
 * that location's local authorities into one MultiPolygon and testing each
 * road feature against it. Skipped for the whole-UK view, where every local
 * authority would be included anyway.
 */
function buildLocationFilter(
	localAuthority: BoundaryData["localAuthority"] | undefined,
	selectedLocation: string,
): MapExpression | undefined {
	if (!localAuthority || !selectedLocation || selectedLocation === "United Kingdom") {
		return undefined;
	}

	const latestYear = Object.keys(localAuthority)
		.map(Number)
		.sort((a, b) => b - a)
		.find((year) => (localAuthority[year]?.features.length ?? 0) > 0);
	const features = latestYear !== undefined ? localAuthority[latestYear]?.features : undefined;
	if (!features || features.length === 0) return undefined;

	const polygons = features
		.map((feature) => feature.geometry?.coordinates)
		.filter((coordinates): coordinates is number[][][] => Array.isArray(coordinates))
		.map(withRfc7946Winding);
	if (polygons.length === 0) return undefined;

	return withinFilter({ type: "MultiPolygon", coordinates: polygons });
}

interface UseMapUpdatesParams {
	geojson: BoundaryGeojson | null;
	activeViz: ActiveViz;
	activeDataset: Dataset | null;
	mapManager: MapManager | null;
	mapOptions: MapOptions;
	styleReady: boolean;
	selectedLocation: string;
	boundaryData: BoundaryData;
}

function getActiveDataOptions(
	activeDataset: Dataset | null,
	activeViz: ActiveViz,
	mapOptions: MapOptions,
): object | null {
	if (!activeDataset) return null;
	if (
		isChartDataset(activeDataset) &&
		activeDataset.type !== "population" &&
		activeDataset.type !== "ethnicity" &&
		activeDataset.type !== "brexit" &&
		activeDataset.type !== "brexitConstituency" &&
		activeDataset.type !== "generalElection" &&
		activeDataset.type !== "localElection"
	) {
		return mapOptions[activeDataset.type];
	}

	switch (activeDataset.type) {
		case "network":
			return null;
		case "generalElection":
			return mapOptions.generalElection;
		case "localElection":
			return mapOptions.localElection;
		case "ethnicity":
			return mapOptions.ethnicity;
		case "brexit":
			return mapOptions.brexit;
		case "brexitConstituency":
			return mapOptions.brexitConstituency;
		case "custom":
			return mapOptions.custom;
		case "population":
			if (activeViz.vizId.startsWith("ageDistribution")) {
				return mapOptions.ageDistribution;
			}
			if (activeViz.vizId.startsWith("populationDensity")) {
				return mapOptions.populationDensity;
			}
			return mapOptions.gender;
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
	boundaryData,
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
					filter: allFilters([
						buildNetworkFilter(
							activeDataset.layer,
							activeDataset.legend,
							mapOptions.network,
						),
						buildLocationFilter(boundaryData.localAuthority, selectedLocation),
					]),
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
		selectedLocation,
		boundaryData.localAuthority,
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
			mapManager.updateMapForCustomPoints(
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
		// that updateMapForCustomPoints() just did — and rebind the hover
		// handlers to an empty record. Effects run in declaration order, so this
		// one always wins; skip it instead.
		if (activeDataset.type === "custom" && activeDataset.kind === "points")
			return;

		const performUpdate = () => {
			if (
				isChartDataset(activeDataset) &&
				activeDataset.type !== "population" &&
				activeDataset.type !== "ethnicity" &&
				activeDataset.type !== "brexit" &&
				activeDataset.type !== "brexitConstituency" &&
				activeDataset.type !== "generalElection" &&
				activeDataset.type !== "localElection"
			) {
				return mapManager.updateMapForScalarDataset(
					geojson,
					activeDataset,
					mapOptions,
				);
			}

			switch (activeDataset.type) {
				case "generalElection":
					return mapManager.updateMapForGeneralElection(
						geojson,
						activeDataset,
						mapOptions,
						isDark,
					);

				case "localElection":
					return mapManager.updateMapForLocalElection(
						geojson,
						activeDataset,
						mapOptions,
						isDark,
					);

				case "ethnicity":
					return mapManager.updateMapForEthnicity(
						geojson,
						activeDataset,
						mapOptions,
						isDark,
					);

				case "brexit":
					return mapManager.updateMapForBrexit(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "brexitConstituency":
					return mapManager.updateMapForBrexitConstituency(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "custom":
					return mapManager.updateMapForCustomDataset(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "population":
					// Handle population sub-categories
					if (activeViz.vizId.startsWith("ageDistribution")) {
						return mapManager.updateMapForAgeDistribution(
							geojson,
							activeDataset,
							mapOptions,
						);
					}
					if (activeViz.vizId.startsWith("populationDensity")) {
						return mapManager.updateMapForPopulationDensity(
							geojson,
							activeDataset,
							mapOptions,
						);
					}
					if (activeViz.vizId.startsWith("gender")) {
						return mapManager.updateMapForGender(
							geojson,
							activeDataset,
							mapOptions,
						);
					}
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
