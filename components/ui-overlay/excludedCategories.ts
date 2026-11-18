import { CATEGORY_DATASET_TYPES } from "@/lib/datasets/categories";
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
	categories: Object.fromEntries(
		CATEGORY_DATASET_TYPES.map((type) => [
			type,
			{
				excluded: new Set(mapOptions[type].excluded ?? []),
				selected:
					mapOptions[type].mode === "percentage"
						? mapOptions[type].selected
						: undefined,
			},
		]),
	),
	excludedPointValues: new Set(mapOptions.custom.excludedPointValues ?? []),
	selectedPointValue: mapOptions.custom.selectedPointValue,
});
