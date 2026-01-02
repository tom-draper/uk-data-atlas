import { useEffect } from "react";
import { ActiveViz, BoundaryGeojson, Dataset } from "@lib/types";
import type { MapManager } from "../helpers/mapManager";
import { MapOptions } from "../types/mapOptions";

interface UseMapUpdatesParams {
	geojson: BoundaryGeojson;
	activeViz: ActiveViz;
	activeDataset: Dataset | null;
	mapManager: MapManager | null;
	mapOptions: MapOptions;
}

export function useMapUpdates({
	geojson,
	activeViz,
	activeDataset,
	mapManager,
	mapOptions,
}: UseMapUpdatesParams) {
	useEffect(() => {
		if (!geojson || !activeDataset || !mapManager) return;

		const performUpdate = () => {
			switch (activeDataset.type) {
				case "generalElection":
					return mapManager.updateMapForGeneralElection(
						geojson,
						activeDataset,
						mapOptions,
					);

				case "localElection":
					return mapManager.updateMapForLocalElection(
						geojson,
						activeDataset,
						mapOptions,
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
	}, [geojson, activeDataset, activeViz, mapManager, mapOptions]);
}
