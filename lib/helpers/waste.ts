import type { IndicatorRecord } from "@uk-data-atlas/datasets/types/indicator";
import type { WasteOptions } from "@/lib/types/mapOptions";

export type WasteStats = Pick<IndicatorRecord, "value" | "metrics">;

export function wasteValue(
	record: WasteStats | undefined,
	options: WasteOptions,
): number | null {
	if (!record) return null;
	if (options.metric === "collected") {
		return options.measure === "perPopulation"
			? (record.metrics?.per100kPopulation ?? null)
			: record.value;
	}
	const recycled = record.metrics?.recycledTonnes;
	if (recycled === undefined) return null;
	if (options.metric === "recyclingShare")
		return record.value > 0 ? (recycled / record.value) * 100 : null;
	if (options.measure === "total") return recycled;
	const perPopulation = record.metrics?.per100kPopulation;
	return perPopulation !== undefined && record.value > 0
		? (recycled / record.value) * perPopulation
		: null;
}

export function aggregateWaste(records: IndicatorRecord[]): WasteStats | null {
	if (!records.length) return null;
	const value = records.reduce((sum, record) => sum + record.value, 0);
	const metrics: Record<string, number> = {};
	if (
		records.every((record) => record.metrics?.recycledTonnes !== undefined)
	) {
		metrics.recycledTonnes = records.reduce(
			(sum, record) => sum + record.metrics!.recycledTonnes,
			0,
		);
	}
	if (
		records.every(
			(record) =>
				record.value > 0 &&
				(record.metrics?.per100kPopulation ?? 0) > 0,
		)
	) {
		const population = records.reduce(
			(sum, record) =>
				sum +
				(record.value / record.metrics!.per100kPopulation) * 100_000,
			0,
		);
		metrics.per100kPopulation = (value / population) * 100_000;
	}
	return { value, metrics };
}
