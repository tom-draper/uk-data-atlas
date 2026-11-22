import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";

const COUNT = "Claimant count";
const RATE = "Claimants as a proportion of residents aged 16-64";

/**
 * The claimant count of each local authority in each month, from January 2013,
 * with the proportion of residents aged 16 to 64 it makes. Every month is on
 * the authorities of April 2023, so no district is merged here. One part per
 * month, keyed `2013-01`.
 *
 * The publisher suppresses a proportion where the count is 1 or 2 (the Isles
 * of Scilly, eight months). It has no value, so it is left out, not read as
 * no claimants.
 */
export async function claimantCountHistoryStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data } = await parseCsv<Record<string, string>>(
		await read(
			sourceDir(
				"claimant-count-history",
				"claimant-count-by-local-authority-2013-01-to-2026-10.csv",
			),
		),
		{ header: true },
	);

	const byMonth = new Map<string, Map<string, DirectRecord>>();
	for (const row of data) {
		const month = row["DATE"]?.trim();
		const code = row["GEOGRAPHY_CODE"]?.trim();
		const value = row["OBS_VALUE"]?.trim();
		const measure = row["MEASURE_NAME"]?.trim();
		if (!month || !code || !value) continue;
		if (measure !== COUNT && measure !== RATE) continue;
		const figure = Number(value);
		if (!Number.isFinite(figure)) continue;

		const records = byMonth.get(month) ?? new Map<string, DirectRecord>();
		const record = records.get(code) ?? {
			code,
			name: row["GEOGRAPHY_NAME"]?.trim() || "",
			values: [],
		};
		record.values.push(
			measure === COUNT
				? {
						measure: "claimants",
						members: { "age-group": "totalCount" },
						value: figure,
					}
				: { measure: "claimant-rate", value: figure },
		);
		records.set(code, record);
		byMonth.set(month, records);
	}

	return [...byMonth.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, records]) => ({ key, records: [...records.values()] }));
}
