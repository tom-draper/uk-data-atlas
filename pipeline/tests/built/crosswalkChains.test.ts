import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

/**
 * The chained crosswalks in the built `atlas.sqlite`
 * (`pnpm data:build --only assemble-atlas`): each area of an old release joined
 * to the current release in one step, with the combined weight and error.
 */
const ATLAS = join(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
	"data/build/atlas.sqlite",
);
const database = new DatabaseSync(ATLAS, { readOnly: true });
afterAll(() => database.close());

const all = (sql: string) =>
	(database.prepare(sql).all() as Array<Record<string, unknown>>).map(
		(row) => ({ ...row }),
	);
const one = (sql: string) => Number(all(sql)[0]!.n);

test("every geography with an older release has a chain from it to the current release", () => {
	assert.ok(one("SELECT count(*) AS n FROM crosswalk_chain") > 0);
	// Every chain ends on the geography's current release, the lowest inventory position.
	assert.deepEqual(
		all(`SELECT c.id FROM crosswalk_chain c
			 JOIN area_release f ON f.id = c.from_release_id
			 JOIN area_release t ON t.id = c.to_release_id
			 WHERE f.geography <> t.geography
			    OR f.inventory_position <= t.inventory_position
			    OR t.inventory_position <> (
			      SELECT min(r.inventory_position) FROM area_release r
			      WHERE r.geography = t.geography)`),
		[],
	);
	// A chain is stored for each pair of releases and basis once.
	assert.deepEqual(
		all(`SELECT from_release_id, to_release_id, coalesce(basis_id, 'any') AS basis
			 FROM crosswalk_chain
			 GROUP BY 1, 2, 3 HAVING count(*) > 1`),
		[],
	);
});

test("the edges of a chain start in its old release and end in the current one", () => {
	assert.deepEqual(
		all(`SELECT e.chain_id, e.from_version_id, e.to_version_id
			 FROM crosswalk_chain_edge e
			 JOIN crosswalk_chain c ON c.id = e.chain_id
			 JOIN area_version f ON f.id = e.from_version_id
			 JOIN area_version t ON t.id = e.to_version_id
			 WHERE f.release_id <> c.from_release_id OR t.release_id <> c.to_release_id
			 LIMIT 20`),
		[],
	);
	assert.equal(
		one(`SELECT count(*) AS n FROM crosswalk_chain c
			 WHERE c.edges <> (SELECT count(*) FROM crosswalk_chain_edge e WHERE e.chain_id = c.id)`),
		0,
	);
});

test("every old area either reaches the current release or is listed as a gap", () => {
	// The gaps of a chain are its areas that lose value, stored or implied.
	assert.equal(
		one(`SELECT count(*) AS n FROM crosswalk_chain c
			 WHERE c.gaps <> (SELECT count(*) FROM v_crosswalk_chain_gap v
			   WHERE v.chain_id = c.id AND v.basis = coalesce(c.basis_id, 'population'))`),
		0,
	);
	// An old area in the inventory with no edge is a gap, and one with edges that sum to 1 is not.
	assert.deepEqual(
		all(`SELECT c.id, v.id AS from_version_id FROM crosswalk_chain c
			 JOIN area_version v ON v.release_id = c.from_release_id AND v.in_inventory = 1
			 WHERE NOT EXISTS (SELECT 1 FROM crosswalk_chain_edge e WHERE e.chain_id = c.id AND e.from_version_id = v.id)
			   AND NOT EXISTS (SELECT 1 FROM v_crosswalk_chain_gap g WHERE g.chain_id = c.id AND g.from_version_id = v.id)
			 LIMIT 20`),
		[],
	);
	assert.deepEqual(
		all(`SELECT g.chain_id, g.from_version_id FROM crosswalk_chain_gap g
			 JOIN area_version v ON v.id = g.from_version_id
			 WHERE v.in_inventory = 0 OR (g.reason = 'not-in-crosswalk' AND NOT EXISTS (
			   SELECT 1 FROM crosswalk_chain_edge e
			   WHERE e.chain_id = g.chain_id AND e.from_version_id = g.from_version_id))
			 LIMIT 20`),
		[],
	);
});

test("an old area's weights sum to at most 1, and to 1 where it has no gap", () => {
	assert.deepEqual(
		all(`SELECT chain_id, from_version_id, sum(weight) AS total
			 FROM crosswalk_chain_edge
			 GROUP BY chain_id, from_version_id
			 HAVING sum(weight) > 1 + 1e-6 LIMIT 20`),
		[],
	);
	assert.deepEqual(
		all(`SELECT e.chain_id, e.from_version_id, sum(e.weight) AS total
			 FROM crosswalk_chain_edge e
			 LEFT JOIN crosswalk_chain_gap g
			   ON g.chain_id = e.chain_id AND g.from_version_id = e.from_version_id
			 WHERE g.chain_id IS NULL
			 GROUP BY e.chain_id, e.from_version_id
			 HAVING abs(sum(e.weight) - 1) > 1e-4 LIMIT 20`),
		[],
	);
});

test("the error of an edge is ordered and inside what its weight allows", () => {
	assert.deepEqual(
		all(`SELECT chain_id, from_version_id, to_version_id
			 FROM crosswalk_chain_edge
			 WHERE weight_lower > weight + 1e-9
			    OR weight_upper < weight - 1e-9
			    OR weight_lower < 0
			    OR at_risk > weight + 1e-9
			    OR pruned > weight + 1e-9
			    OR (weight_lower IS NULL) <> (weight_upper IS NULL)
			 LIMIT 20`),
		[],
	);
	// An edge with nothing at risk or pruned has bounds that close on its weight.
	assert.deepEqual(
		all(`SELECT chain_id, from_version_id, to_version_id
			 FROM crosswalk_chain_edge
			 WHERE at_risk = 0 AND pruned = 0
			   AND (weight_lower <> weight OR weight_upper <> weight)
			 LIMIT 20`),
		[],
	);
});

test("a chain stored without a basis is the same on every basis, and every other chain has one", () => {
	// A basis changes a chain only where an old area is split, so a chain stored
	// once for every basis sends each of its old areas to one current area. It
	// may still be inexact, with weight pruned from a postcode-overlap hop.
	assert.deepEqual(
		all(`SELECT c.id FROM crosswalk_chain c
			 WHERE c.basis_id IS NULL AND EXISTS (
			   SELECT 1 FROM crosswalk_chain_edge e WHERE e.chain_id = c.id
			   GROUP BY e.from_version_id HAVING count(*) > 1)
			 LIMIT 20`),
		[],
	);
	assert.deepEqual(
		all(`SELECT id FROM crosswalk_chain
			 WHERE exact = 1 AND basis_id IS NOT NULL LIMIT 20`),
		[],
	);
});

test("each chain lists the crosswalks of its route in order, from the old release to the current", () => {
	assert.deepEqual(
		all(`SELECT c.id FROM crosswalk_chain c
			 WHERE c.hops <> (SELECT count(*) FROM crosswalk_chain_hop h WHERE h.chain_id = c.id)
			    OR c.hops < 1`),
		[],
	);
	assert.deepEqual(
		all(`SELECT h.chain_id, h.position FROM crosswalk_chain_hop h
			 JOIN crosswalk_chain c ON c.id = h.chain_id
			 WHERE h.position = 1
			   AND NOT EXISTS (
			     SELECT 1 FROM crosswalk x
			     WHERE x.id = h.crosswalk_id
			       AND (x.from_release_id = c.from_release_id OR x.to_release_id = c.from_release_id))
			 LIMIT 20`),
		[],
	);
});

test("v_crosswalk_chain_edge reads a chain stored without a basis once for each basis", () => {
	assert.deepEqual(
		all(`SELECT chain_id, from_version_id, to_version_id, count(*) AS n
			 FROM v_crosswalk_chain_edge
			 GROUP BY chain_id, from_version_id, to_version_id, basis HAVING n > 1
			 LIMIT 20`),
		[],
	);
	assert.deepEqual(
		all(`SELECT DISTINCT basis FROM v_crosswalk_chain_edge ORDER BY basis`),
		[
			{ basis: "dwellings" },
			{ basis: "households" },
			{ basis: "population" },
			{ basis: "postcodes" },
		],
	);
	// A chain with one basis shows only that basis.
	assert.equal(
		one(`SELECT count(*) AS n FROM v_crosswalk_chain_edge v
			 JOIN crosswalk_chain c ON c.id = v.chain_id
			 WHERE c.basis_id IS NOT NULL AND c.basis_id <> v.basis`),
		0,
	);
});

test("any ward of an old release reaches the current wards in one join", () => {
	const rows =
		all(`SELECT v.from_release, v.to_release, v.from_code, v.to_code, v.weight
		FROM v_crosswalk_chain_edge v
		WHERE v.geography = 'ward' AND v.basis = 'population'
		  AND v.from_code = 'E05000719'
		ORDER BY v.from_release`);
	assert.ok(rows.length > 0);
	const current = all(`SELECT release FROM area_release
		WHERE geography = 'ward' ORDER BY inventory_position LIMIT 1`)[0]!.release;
	for (const row of rows) assert.equal(row.to_release, current);
	// The oldest ward release reaches the current wards.
	assert.ok(
		rows.some((row) => row.from_release === "2011-12-ew-bgc"),
		"the 2011 ward is joined to the current wards",
	);
});

test("every older release reaches the current one, bar the releases no carrying crosswalk joins", () => {
	// Releases with no crosswalk that carries a value to the next one, plus
	// nhsEnglandRegion 2022-07, whose only crosswalk is area-overlap, which is not
	// a carrying method, and dataZone 2021-ni, which is not a Scottish release.
	const unrouted = all(`SELECT r.geography, r.release FROM area_release r
		WHERE r.inventory_position > (
		  SELECT min(x.inventory_position) FROM area_release x WHERE x.geography = r.geography)
		  AND NOT EXISTS (SELECT 1 FROM crosswalk_chain c WHERE c.from_release_id = r.id)
		ORDER BY 1, 2`);
	assert.deepEqual(
		unrouted.map((row) => `${row.geography}|${row.release}`),
		[
			"countyElectoralDivision|2017-05-en-names",
			"countyElectoralDivision|2023-05-en-bgc",
			"dataZone|2011-12-sc-bfc",
			"dataZone|2021-ni",
			"historicalConstituency|1918-uk",
			"historicalConstituency|1945-uk",
			"historicalConstituency|1950-uk",
			"historicalConstituency|1955-uk",
			"historicalConstituency|1974-uk",
			"historicalConstituency|1983-uk",
			"historicalConstituency|1997-uk",
			"integratedCareBoard|2023-04-en-bgc",
			"nhsEnglandRegion|2022-07-en-bgc",
		],
	);
	// The releases the postcode-overlap crosswalks added all reach the current one.
	for (const release of [
		"localAuthority|2008-12-gb-bgc",
		"localAuthority|2009-12-gb-bgc",
		"scottishParliamentaryConstituency|2016-05-sc-gcb",
		"scottishParliamentaryConstituency|2021-05-sc-bgc",
		"scottishParliamentaryConstituency|2022-12-sc-bgc",
		"seneddConstituency|2022-12-w-bgc",
	]) {
		const [geography, name] = release.split("|");
		assert.ok(
			one(`SELECT count(*) AS n FROM crosswalk_chain c
				 JOIN area_release f ON f.id = c.from_release_id
				 WHERE f.geography = '${geography}' AND f.release = '${name}'`) > 0,
			`${release} has a chain to the current release`,
		);
	}
});
