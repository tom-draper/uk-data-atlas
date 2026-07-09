import { useEffect } from "react";
import { ActiveViz, BoundaryGeojson, Dataset } from "@lib/types";
import type { MapManager } from "../helpers/mapManager";
import { MapOptions } from "../types/mapOptions";
import { useIsDark } from "../context/ThemeContext";
import { gazetteer } from "../data/gazetteer/static";

interface UseMapUpdatesParams {
	geojson: BoundaryGeojson | null;
	activeViz: ActiveViz;
	activeDataset: Dataset | null;
	mapManager: MapManager | null;
	mapOptions: MapOptions;
	styleReady: boolean;
	selectedLocation: string;
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

	useEffect(() => {
		if (!mapManager || !styleReady) return;
		mapManager.setBorderVisibility(mapOptions.visibility.hideBorders);
	}, [mapManager, styleReady, mapOptions.visibility.hideBorders]);

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
			);
		} else {
			mapManager.clearCustomPoints();
		}
	}, [activeDataset, mapManager, mapOptions, styleReady, selectedLocation]);

	useEffect(() => {
		if (!geojson || !activeDataset || !mapManager) return;

		const performUpdate = () => {
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

				case "housePrice":
					return mapManager.updateMapForHousePrices(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "crime":
					return mapManager.updateMapForCrimeRate(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "income":
					return mapManager.updateMapForIncome(
						geojson,
						activeDataset,
						mapOptions,
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

				case "broadband":
					return mapManager.updateMapForBroadband(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "airQuality":
					return mapManager.updateMapForAirQuality(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "schoolPerformance":
					return mapManager.updateMapForSchoolPerformance(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "claimantCount":
					return mapManager.updateMapForClaimantCount(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "nhsWaiting":
					return mapManager.updateMapForNHSWaiting(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "unemployment":
					return mapManager.updateMapForUnemployment(
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
		mapOptions,
		styleReady,
		isDark,
	]);
}
