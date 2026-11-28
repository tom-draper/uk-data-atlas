import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

/**
 * The derived crosswalk from integrated care boards April 2023 to April 2026
 * in the built `atlas.sqlite`. ONS publishes no lookup between the two, so it
 * is calibrated against the published codes: a board whose code is in both
 * releases kept its area apart from small moves, and every abolished board
 * went into one of the boards first coded in 2026 (the Integrated Care Boards
 * (Establishment and Abolition) Order 2026).
 */
const ATLAS = join(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
	"data/build/atlas.sqlite",
);
const database = new DatabaseSync(ATLAS, { readOnly: true });
afterAll(() => database.close());

const SLUG =
	"integrated-care-board-2023-04-en-bgc-to-2026-04-en-bgc-postcode-overlap";

const rows = () =>
	database
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
					 WHERE r.geography = 'integratedCareBoard' AND r.release = ?`,
				)
				.all(release) as Array<{ code: string }>
		).map((row) => row.code),
	);

/** The 2026 boards formed by the Order (E54000065 to E54000071). */
const FORMED = new Set([
	"E54000065", // NHS Central East
	"E54000066", // NHS Essex
	"E54000067", // NHS Hampshire and Isle of Wight
	"E54000068", // NHS Norfolk and Suffolk
	"E54000069", // NHS Surrey and Sussex
	"E54000070", // NHS Thames Valley
	"E54000071", // NHS West and North London
]);

test("the 2023 to 2026 integrated care board crosswalk weighs every 2023 board", () => {
	const totals = new Map<string, number>();
	for (const row of rows())
		totals.set(row.source, (totals.get(row.source) ?? 0) + row.weight);
	assert.equal(totals.size, codes("2023-04-en-bgc").size);
	for (const [code, total] of totals)
		assert.ok(Math.abs(total - 1) < 1e-6, `${code} sums to ${total}`);
});

test("the 2023 to 2026 integrated care board crosswalk agrees with the published codes", () => {
	const later = codes("2026-04-en-bgc");
	assert.deepEqual(
		[...FORMED].filter((code) => !later.has(code)),
		[],
	);
	const kept = new Map<string, number>();
	const formed = new Map<string, number>();
	for (const row of rows()) {
		if (row.source === row.target)
			kept.set(row.source, (kept.get(row.source) ?? 0) + row.weight);
		if (FORMED.has(row.target))
			formed.set(row.source, (formed.get(row.source) ?? 0) + row.weight);
	}
	const sources = codes("2023-04-en-bgc");
	const continuing = [...sources].filter((code) => later.has(code));
	const abolished = [...sources].filter((code) => !later.has(code));
	// 42 boards less the 12 abolished and the one recoded for its new boundary.
	assert.equal(continuing.length, 29);
	assert.equal(abolished.length, 13);
	for (const code of continuing)
		assert.ok(
			(kept.get(code) ?? 0) > 0.98,
			`${code} keeps ${kept.get(code) ?? 0}`,
		);
	for (const code of abolished)
		assert.ok(
			(formed.get(code) ?? 0) > 0.98,
			`${code} goes ${formed.get(code) ?? 0} into the new boards`,
		);
});
