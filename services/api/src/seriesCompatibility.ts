import {
	measureSeriesKey,
	type MeasureCompatibilityInventory,
	type MeasureDimensionsConfig,
} from "@uk-data-atlas/measures";

type Entry = MeasureCompatibilityInventory["measures"][number];
const indexes = new WeakMap<
	MeasureCompatibilityInventory,
	WeakMap<MeasureDimensionsConfig, Map<string, Entry>>
>();

export const seriesCompatibility = (
	inventory: MeasureCompatibilityInventory | undefined,
	config: MeasureDimensionsConfig | undefined,
	seriesKey: string | undefined,
	measureId: string,
): Entry | undefined => {
	if (!inventory) return undefined;
	if (!seriesKey)
		return inventory.measures.find(
			(entry) => entry.measureId === measureId,
		);
	const published = inventory.measures.find(
		(entry) => entry.seriesKey === seriesKey,
	);
	if (published || !config) return published;
	let configs = indexes.get(inventory);
	if (!configs) {
		configs = new WeakMap();
		indexes.set(inventory, configs);
	}
	let index = configs.get(config);
	if (!index) {
		index = new Map();
		for (const entry of inventory.measures) {
			const identity = config.ids[entry.measureId];
			const key =
				entry.seriesKey ?? (identity && measureSeriesKey(identity));
			if (key) index.set(key, entry);
		}
		configs.set(config, index);
	}
	return index.get(seriesKey);
};
