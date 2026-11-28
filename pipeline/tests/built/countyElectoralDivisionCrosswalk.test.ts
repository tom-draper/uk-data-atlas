import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

/**
 * The derived crosswalk from county electoral divisions May 2023 to May 2025
 * in the built `atlas.sqlite`. ONS publishes no lookup between the two, so it
 * is calibrated against the published codes: a division whose code is in both
 * releases was not redrawn, so nearly all of its residents stay in it.
 */
const ATLAS = join(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
	"data/build/atlas.sqlite",
);
const database = new DatabaseSync(ATLAS, { readOnly: true });
afterAll(() => database.close());

const SLUG =
	"county-electoral-division-2023-05-en-bgc-to-2025-05-en-bgc-postcode-overlap";

const rows = database
	.prepare(
		`SELECT fa.code AS source, ta.code AS target, w.weight
		 FROM crosswalk_weight w
		 JOIN crosswalk c ON c.id = w.crosswalk_id
		 JOIN area_version f ON f.id = w.from_version_id JOIN area fa ON fa.id = f.area_id
		 JOIN area_version t ON t.id = w.to_version_id JOIN area ta ON ta.id = t.area_id
		 WHERE c.slug = ? AND w.basis_id = 'population'`,
	)
	.all(SLUG) as Array<{ source: string; target: string; weight: number }>;

const codes = (release: string) =>
	new Set(
		(
			database
				.prepare(
					`SELECT a.code FROM area_version v
					 JOIN area a ON a.id = v.area_id
					 JOIN area_release r ON r.id = v.release_id
					 WHERE r.geography = 'countyElectoralDivision' AND r.release = ?`,
				)
				.all(release) as Array<{ code: string }>
		).map((row) => row.code),
	);

test("the 2023 to 2025 county electoral division crosswalk weighs every division in full", () => {
	const totals = new Map<string, number>();
	for (const row of rows)
		totals.set(row.source, (totals.get(row.source) ?? 0) + row.weight);
	// A few divisions may hold no residents' postcodes and have no weight.
	assert.ok(totals.size > 1350, `${totals.size} divisions weighed`);
	for (const [code, total] of totals)
		assert.ok(Math.abs(total - 1) < 1e-6, `${code} sums to ${total}`);
});

test("a county electoral division with the same code in 2023 and 2025 keeps its residents", () => {
	const later = codes("2025-05-en-bgc");
	const kept = new Map<string, number>();
	for (const row of rows)
		if (row.source === row.target)
			kept.set(row.source, (kept.get(row.source) ?? 0) + row.weight);
	const continuing = [...codes("2023-05-en-bgc")].filter((code) =>
		later.has(code),
	);
	assert.ok(continuing.length > 1000);
	// Generalised boundaries and postcode centroids misplace a few residents.
	const low = continuing.filter((code) => (kept.get(code) ?? 0) < 0.95);
	assert.ok(
		low.length <= continuing.length * 0.01,
		`${low.length} divisions keep under 95%: ${low.slice(0, 10).join(", ")}`,
	);
});
