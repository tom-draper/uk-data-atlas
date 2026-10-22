import type { PopulationLocalAuthorityData } from "../../types/population";

export function addPopulationMetrics<
	T extends { metrics?: Record<string, number> },
>(
	records: Record<string, T>,
	population: Record<string, PopulationLocalAuthorityData>,
	value: (record: T) => number,
) {
	for (const [code, record] of Object.entries(records)) {
		const total = Object.values(population[code]?.total ?? {}).reduce(
			(sum, count) => sum + count,
			0,
		);
		if (total > 0) {
			record.metrics = {
				...record.metrics,
				per100kPopulation: (value(record) / total) * 100_000,
			};
		}
	}
}
