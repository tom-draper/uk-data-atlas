import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { CENSUS_TABLES } from "../../src/conversion/backtestCases.ts";

/** Every published count series is conserved on the 2026-05 authorities. */
const path = fileURLToPath(
	new URL("../../../data/build/atlas.sqlite", import.meta.url),
);

test("each nation census table keeps every count, series by series, on the 2026-05 authorities and 2025-12 countries", (context) => {
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
		`SELECT s.method AS method, r.geography AS geography, coalesce(s.derived_from_id, s.id) AS published_id, sum(o.value) AS total
		FROM series s JOIN dataset d ON d.id = s.dataset_id
		JOIN area_release r ON r.id = s.release_id
		JOIN observation o ON o.series_id = s.id
		WHERE d.slug = ? AND (s.method = 'published' OR
			(r.geography = 'localAuthority' AND r.release = '2026-05-uk-bgc') OR
			(r.geography = 'country' AND r.release = '2025-12-uk-bgc'))
		GROUP BY s.method, r.geography, published_id`,
	);
	for (const { dataset } of CENSUS_TABLES.nations) {
		const rows = totals.all(dataset) as {
			method: string;
			geography: string;
			published_id: number;
			total: number;
		}[];
		const counts = (method: string, geography?: string) =>
			new Map(
				rows
					.filter(
						(row) =>
							row.method === method &&
							(!geography || row.geography === geography),
					)
					.map((row) => [row.published_id, row.total]),
			);
		const published = counts("published");
		assert.ok(published.size, `${dataset} has no published series`);
		for (const geography of ["localAuthority", "country"]) {
			assert.deepEqual(
				counts("converted", geography),
				published,
				`${dataset} counts by series on ${geography}`,
			);
		}
	}
});
