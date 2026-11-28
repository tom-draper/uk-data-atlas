import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

/**
 * The derived crosswalk from Scottish data zones 2011 to 2022 in the built
 * `atlas.sqlite`. No publisher lookup joins the two, so it is calibrated
 * against the official council of each zone: data zones nest in councils, and
 * the 2019 council changes moved few residents, so nearly all of a 2011 zone's
 * residents must land in 2022 zones of the same council.
 */
const ATLAS = join(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
	"data/build/atlas.sqlite",
);
const database = new DatabaseSync(ATLAS, { readOnly: true });
afterAll(() => database.close());

const SLUG = "data-zone-2011-12-sc-bfc-to-2022-sc-bfc-postcode-overlap";

/**
 * Councils recoded in 2019 for their boundary change (ONS Code History
 * Database), from the 2018 code to the 2024 one.
 */
const RECODED = new Map([
	["S12000046", "S12000049"], // Glasgow City
	["S12000044", "S12000050"], // North Lanarkshire
]);

const all = (sql: string, ...params: Array<string>) =>
	(
		database.prepare(sql).all(...params) as Array<Record<string, unknown>>
	).map((row) => ({ ...row }));

/** The code each from area of a crosswalk is joined to, by from version id. */
const targetCodes = (slug: string) =>
	new Map(
		all(
			`SELECT e.from_version_id AS zone, a.code
			 FROM crosswalk_edge e
			 JOIN crosswalk c ON c.id = e.crosswalk_id
			 JOIN area_version v ON v.id = e.to_version_id
			 JOIN area a ON a.id = v.area_id
			 WHERE c.slug = ?`,
			slug,
		).map((row) => [Number(row.zone), String(row.code)]),
	);

test("the 2011 to 2022 data zone crosswalk weighs every 2011 zone in full", () => {
	const sources = all(
		`SELECT w.from_version_id AS zone, sum(w.weight) AS total
		 FROM crosswalk_weight w JOIN crosswalk c ON c.id = w.crosswalk_id
		 WHERE c.slug = ? AND w.basis_id = 'population'
		 GROUP BY 1`,
		SLUG,
	);
	// 6,976 zones in 2011; a handful with no residents have no weight.
	assert.ok(sources.length > 6900, `${sources.length} zones weighed`);
	assert.deepEqual(
		sources.filter((row) => Math.abs(Number(row.total) - 1) > 1e-6),
		[],
	);
});

test("the 2011 to 2022 data zone crosswalk keeps residents in their council", () => {
	// 2011 zone -> 2011 intermediate zone -> 2018 council.
	const zoneToIz = targetCodes(
		"data-zone-2011-12-sc-bfc-to-intermediate-zone-2011-12-sc-bfc-official-lookup",
	);
	const izToCouncil = new Map(
		all(
			`SELECT a.code AS iz, ta.code AS council
			 FROM crosswalk_edge e
			 JOIN crosswalk c ON c.id = e.crosswalk_id
			 JOIN area_version f ON f.id = e.from_version_id JOIN area a ON a.id = f.area_id
			 JOIN area_version t ON t.id = e.to_version_id JOIN area ta ON ta.id = t.area_id
			 WHERE c.slug = ?`,
			"intermediate-zone-2011-12-sc-bfc-to-local-authority-2018-12-uk-bgc-official-lookup",
		).map((row) => [String(row.iz), String(row.council)]),
	);
	const before = new Map(
		[...zoneToIz].map(([zone, iz]) => {
			const council = izToCouncil.get(iz)!;
			return [zone, RECODED.get(council) ?? council];
		}),
	);
	const after = targetCodes(
		"data-zone-2022-sc-bfc-to-local-authority-2024-12-uk-bgc-official-lookup",
	);
	const weights = all(
		`SELECT w.from_version_id AS source, w.to_version_id AS target, w.weight
		 FROM crosswalk_weight w JOIN crosswalk c ON c.id = w.crosswalk_id
		 WHERE c.slug = ? AND w.basis_id = 'population'`,
		SLUG,
	);
	let kept = 0;
	let total = 0;
	for (const row of weights) {
		const from = before.get(Number(row.source));
		const to = after.get(Number(row.target));
		assert.ok(from && to, `council of ${row.source} or ${row.target}`);
		total += Number(row.weight);
		if (from === to) kept += Number(row.weight);
	}
	assert.ok(
		kept / total > 0.995,
		`${((100 * kept) / total).toFixed(2)}% kept`,
	);
});
