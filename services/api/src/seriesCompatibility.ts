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
	if (!seriesKey || !config)
		return inventory.measures.find(
			(entry) => entry.measureId === measureId,
		);
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
			if (identity) index.set(measureSeriesKey(identity), entry);
		}
		configs.set(config, index);
	}
	return index.get(seriesKey);
};
