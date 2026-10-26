import type { DatabaseSync } from "node:sqlite";

export function rebuildFuelPoverty(database: DatabaseSync): string {
	const periods = database
		.prepare(
			"SELECT period, header FROM catalogue_periods WHERE dataset = 'fuelPoverty' ORDER BY position",
		)
		.all();
	if (periods.length === 0) throw new Error("Missing fuel poverty periods");
	const result: Record<string, unknown> = {};
	for (const period of periods) {
		const data: Record<string, Record<string, unknown>> = {};
		const rows = database
			.prepare(
				`
			SELECT a.code, r.label, m.field, o.value
			FROM catalogue_records r JOIN areas a ON a.id = r.areaId
			JOIN catalogue_observations o ON o.dataset = r.dataset AND o.period = r.period AND o.areaId = r.areaId
			JOIN catalogue_measures m ON m.dataset = o.dataset AND m.id = o.measure
			WHERE r.dataset = 'fuelPoverty' AND r.period = ?
			ORDER BY r.position, m.position
		`,
			)
			.all(period.period);
		for (const row of rows) {
			const code = String(row.code);
			data[code] ??= { lsoaCode: code, lsoaName: row.label };
			data[code][String(row.field)] = row.value;
		}
		result[String(period.period)] = {
			...JSON.parse(String(period.header)),
			data,
		};
	}
	return JSON.stringify(result);
}
