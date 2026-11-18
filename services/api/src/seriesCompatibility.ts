import { type MeasureCompatibilityInventory } from "@uk-data-atlas/measures";
type Entry = MeasureCompatibilityInventory["measures"][number];

export const seriesCompatibility = (
	inventory: MeasureCompatibilityInventory | undefined,
	seriesKey: string | undefined,
): Entry | undefined => {
	if (!inventory || !seriesKey) return undefined;
	return inventory.measures.find((entry) => entry.seriesKey === seriesKey);
};
