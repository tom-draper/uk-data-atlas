import { useEffect } from "react";
import { ActiveViz, BoundaryGeojson, Dataset } from "@lib/types";
import type { MapManager } from "../helpers/mapManager";
import { MapOptions } from "../types/mapOptions";
import { useIsDark } from "../context/ThemeContext";
import { gazetteer } from "../data/gazetteer/static";
import { isScalarDataset } from "../datasets";

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
	if (
		isScalarDataset(activeDataset) &&
		activeDataset.type !== "population" &&
		activeDataset.type !== "ethnicity" &&
		activeDataset.type !== "imd" &&
		activeDataset.type !== "simd" &&
		activeDataset.type !== "wimd" &&
		activeDataset.type !== "nimdm" &&
		activeDataset.type !== "lifeExpectancy" &&
		activeDataset.type !== "qualification"
	) {
		return mapOptions[activeDataset.type];
	}

	switch (activeDataset.type) {
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
		case "imd":
			return mapOptions.imd;
		case "simd":
			return mapOptions.simd;
		case "wimd":
			return mapOptions.wimd;
		case "nimdm":
			return mapOptions.nimdm;
		case "lifeExpectancy":
			return mapOptions.lifeExpectancy;
		case "qualification":
			return mapOptions.qualification;
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
		isScalarDataset(activeDataset) &&
		activeDataset.type !== "population" &&
		activeDataset.type !== "ethnicity" &&
		activeDataset.type !== "imd" &&
		activeDataset.type !== "simd" &&
		activeDataset.type !== "wimd" &&
		activeDataset.type !== "nimdm" &&
		activeDataset.type !== "lifeExpectancy" &&
		activeDataset.type !== "qualification"
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

				case "imd":
					return mapManager.updateMapForIMD(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "simd":
					return mapManager.updateMapForSIMD(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "wimd":
					return mapManager.updateMapForWIMD(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "nimdm":
					return mapManager.updateMapForNIMDM(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "qualification":
					return mapManager.updateMapForQualification(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "lifeExpectancy":
					return mapManager.updateMapForLifeExpectancy(
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
