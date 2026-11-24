import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

/**
 * The Scotland and Northern Ireland census tables are published on data zones
 * alone, so no census figure on a coarser release exists to back-test the
 * conversion against (see `CENSUS_TABLES` in `backtestCases.ts`). The route
 * from a data zone to its council is an official lookup in which each zone
 * nests, so the check that can be made is conservation: no resident is lost or
 * invented moving a table onto the 2026-05 authorities. Skipped where no atlas
 * has been built.
 */

const path = fileURLToPath(
	new URL("../../../data/build/atlas.sqlite", import.meta.url),
);

const TABLES = [
	"census-2022-scotland-uv101b",
	"census-2022-scotland-uv102b",
	"census-2022-scotland-uv113",
	"census-2022-scotland-uv302",
	"census-2022-scotland-uv404",
	"census-2021-ni-a01",
	"census-2021-ni-e01",
];

test("each nation census table keeps every count, series by series, on the 2026-05 authorities", (context) => {
	if (!existsSync(path)) return context.skip();
	const database = new DatabaseSync(path, { readOnly: true });
	context.onTestFinished(() => database.close());
	const held = database
		.prepare(
			"SELECT count(*) AS n FROM sqlite_master WHERE name = 'series_conversion'",
		)
		.get() as { n: number };
	if (held.n === 0) return context.skip();
	const totals = database.prepare(
		`SELECT s.method AS method, count(DISTINCT s.id) AS series, sum(o.value) AS total
		FROM series s JOIN dataset d ON d.id = s.dataset_id
		JOIN area_release r ON r.id = s.release_id
		JOIN observation o ON o.series_id = s.id
		WHERE d.slug = ? AND (s.method = 'published' OR
			(r.geography = 'localAuthority' AND r.release = '2026-05-uk-bgc'))
		GROUP BY s.method`,
	);
	for (const table of TABLES) {
		const rows = new Map(
			(
				totals.all(table) as {
					method: string;
					series: number;
					total: number;
				}[]
			).map((row) => [row.method, row]),
		);
		const published = rows.get("published");
		const converted = rows.get("converted");
		if (!published || !converted) {
			assert.fail(`${table} has no published or converted series`);
		}
		assert.equal(converted.series, published.series, `${table} series`);
		assert.equal(converted.total, published.total, `${table} counts`);
	}
});
