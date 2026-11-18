import { type MeasureCompatibilityInventory } from "@uk-data-atlas/measures";
type Entry = MeasureCompatibilityInventory["measures"][number];

export const seriesCompatibility = (
	inventory: MeasureCompatibilityInventory | undefined,
	seriesKey: string | undefined,
	measureId: string,
): Entry | undefined => {
	if (!inventory) return undefined;
	if (!seriesKey)
		return inventory.measures.find(
			(entry) => entry.measureId === measureId,
		);
	return inventory.measures.find((entry) => entry.seriesKey === seriesKey);
};
