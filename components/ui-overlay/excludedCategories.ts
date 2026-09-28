import type { MapOptions } from "@/lib/types/mapOptions";

export const excludedCategoriesForMapOptions = (mapOptions: MapOptions) => ({
	excludedGeneralParties: new Set(mapOptions.generalElection.excluded ?? []),
	selectedGeneralParty:
		mapOptions.generalElection.mode === "percentage"
			? mapOptions.generalElection.selected
			: undefined,
	excludedLocalParties: new Set(mapOptions.localElection.excluded ?? []),
	selectedLocalParty:
		mapOptions.localElection.mode === "percentage"
			? mapOptions.localElection.selected
			: undefined,
	excludedEthnicities: new Set(mapOptions.ethnicity.excluded ?? []),
	selectedEthnicity:
		mapOptions.ethnicity.mode === "percentage"
			? mapOptions.ethnicity.selected
			: undefined,
	excludedPointValues: new Set(mapOptions.custom.excludedPointValues ?? []),
	selectedPointValue: mapOptions.custom.selectedPointValue,
});
