import { useEffect } from "react";
import { ActiveViz, BoundaryGeojson, Dataset } from "@lib/types";
import type { MapManager } from "../helpers/mapManager";
import { MapOptions } from "../types/mapOptions";
import { useIsDark } from "../context/ThemeContext";

interface UseMapUpdatesParams {
	geojson: BoundaryGeojson | null;
	activeViz: ActiveViz;
	activeDataset: Dataset | null;
	mapManager: MapManager | null;
	mapOptions: MapOptions;
	styleReady: boolean;
}

export function useMapUpdates({
	geojson,
	activeViz,
	activeDataset,
	mapManager,
	mapOptions,
	styleReady,
}: UseMapUpdatesParams) {
	const isDark = useIsDark();
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
	}, [geojson, activeDataset, activeViz, mapManager, mapOptions, styleReady, isDark]);
}
