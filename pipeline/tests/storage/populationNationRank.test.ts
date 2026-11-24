import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { MEASURE_PREFERENCES } from "@uk-data-atlas/measures";
import { test } from "vitest";

/**
 * population-uk repackages the National Records of Scotland and NISRA council
 * figures through the ONS. NRS has revised its mid-2023 and mid-2024 totals
 * since, so the nation files, and the data-zone sums that agree with them,
 * must always outrank it.
 */

const order = MEASURE_PREFERENCES.population!.datasets!.order;

test("the nation council files and the small-area sums outrank population-uk", () => {
	const rank = (dataset: string) => {
		const index = order.indexOf(dataset);
		assert.notEqual(index, -1, `${dataset} is ranked`);
		return index;
	};
	for (const better of [
		"population-data-zone-scotland",
		"population-data-zone-ni",
		"population-council-scotland",
		"population-district-ni",
	])
		assert.ok(
			rank(better) < rank("population-uk"),
			`${better} ranks before population-uk`,
		);
});

const path = fileURLToPath(
	new URL("../../../data/build/atlas.sqlite", import.meta.url),
);

test("population-uk supplies no default population value for a Scottish or Northern Irish area", (context) => {
	if (!existsSync(path)) return context.skip();
	const database = new DatabaseSync(path, { readOnly: true });
	context.onTestFinished(() => database.close());
	const view = database
		.prepare(
			"SELECT count(*) AS n FROM sqlite_master WHERE name = 'v_observation_default'",
		)
		.get() as { n: number };
	if (view.n === 0) return context.skip();
	const stale = database
		.prepare(
			`SELECT count(*) AS n FROM v_observation_default
			WHERE measure = 'population' AND dataset = 'population-uk'
			AND (area_code LIKE 'S12%' OR area_code LIKE 'N09%')`,
		)
		.get() as { n: number };
	assert.equal(stale.n, 0);
});
