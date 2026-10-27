import { readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";

import {
	STATISTICS_DATASETS,
	UNSTORED_DATASETS,
} from "@uk-data-atlas/atlas-runtime/catalogue";

/**
 * Reads the built `data/build/atlas.sqlite`. Every catalogue dataset is either
 * stored as statistics rows (the build checks each value is claimed and the
 * row count matches) or listed as unstored with a reason.
 */
it("stores every configured catalogue dataset as statistics rows", () => {
	const manifest: { datasets: { type: string; output: string }[] } =
		JSON.parse(
			readFileSync("data/build/datasets/dataset-manifest.json", "utf8"),
		);
	const configured = new Set(STATISTICS_DATASETS.map(({ type }) => type));
	for (const { type } of manifest.datasets)
		expect(
			type === "fuelPoverty" ||
				configured.has(type) ||
				type in UNSTORED_DATASETS,
			type,
		).toBe(true);

	const database = new DatabaseSync("data/build/atlas.sqlite", {
		readOnly: true,
	});
	try {
		expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
		const counts = Object.fromEntries(
			database
				.prepare(
					`SELECT d.slug, count(DISTINCT s.id) AS series, count(*) AS observations
					 FROM observation o JOIN series s ON s.id = o.series_id JOIN dataset d ON d.id = s.dataset_id
					 GROUP BY d.slug ORDER BY observations DESC`,
				)
				.all()
				.map((row) => [
					String(row.slug),
					{
						series: Number(row.series),
						observations: Number(row.observations),
					},
				]),
		);
		for (const { type, output } of manifest.datasets)
			if (type === "fuelPoverty" || configured.has(type))
				expect(counts[output]?.observations, output).toBeGreaterThan(0);
		let tableBytes: Record<string, number> | null = null;
		try {
			tableBytes = Object.fromEntries(
				database
					.prepare(
						"SELECT d.name, sum(d.pgsize) AS bytes FROM dbstat d JOIN sqlite_master m ON m.name = d.name WHERE m.tbl_name IN ('observation', 'series', 'series_member', 'dimension_member', 'dataset_area_name') GROUP BY d.name ORDER BY bytes DESC",
					)
					.all()
					.map((row) => [String(row.name), Number(row.bytes)]),
			);
		} catch {
			// dbstat is a compile-time option.
		}
		const observations = Object.values(counts).reduce(
			(sum, { observations }) => sum + observations,
			0,
		);
		writeFileSync(
			"data/build/statistics-datasets.json",
			JSON.stringify(
				{
					datasets: Object.keys(counts).length,
					observations,
					tableBytes,
					bytesPerObservation: tableBytes
						? Object.entries(tableBytes)
								.filter(([name]) =>
									name.startsWith("observation"),
								)
								.reduce((sum, [, bytes]) => sum + bytes, 0) /
							observations
						: null,
					unstored: UNSTORED_DATASETS,
					counts,
				},
				null,
				"\t",
			),
		);
	} finally {
		database.close();
	}
}, 120_000);
