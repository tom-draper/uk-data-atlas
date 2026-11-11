import type { IndicatorRecord } from "../../types/indicator.ts";

export type WasteStats = Pick<IndicatorRecord, "value" | "metrics">;

/**
 * Collected and recycled tonnes add across authorities, and a figure is kept
 * only when every authority has it. The rate per 100,000 residents is rebuilt
 * from the summed population each authority's rate implies, rather than
 * averaged.
 */
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
