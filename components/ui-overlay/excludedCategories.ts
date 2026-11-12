import type { MapOptions } from "@/lib/types/mapOptions";

export const excludedCategoriesForMapOptions = (mapOptions: MapOptions) => ({
	excludedGeneralParties: new Set(
		mapOptions["general-election"].excluded ?? [],
	),
	selectedGeneralParty:
		mapOptions["general-election"].mode === "percentage"
			? mapOptions["general-election"].selected
			: undefined,
	excludedLocalParties: new Set(mapOptions["local-election"].excluded ?? []),
	selectedLocalParty:
		mapOptions["local-election"].mode === "percentage"
			? mapOptions["local-election"].selected
			: undefined,
	excludedEthnicities: new Set(mapOptions.ethnicity.excluded ?? []),
	selectedEthnicity:
		mapOptions.ethnicity.mode === "percentage"
			? mapOptions.ethnicity.selected
			: undefined,
	excludedPointValues: new Set(mapOptions.custom.excludedPointValues ?? []),
	selectedPointValue: mapOptions.custom.selectedPointValue,
});
