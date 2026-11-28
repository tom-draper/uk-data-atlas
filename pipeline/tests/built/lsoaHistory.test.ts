import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

/**
 * The ONS LSOA 2001 to 2011 lookup in the built `atlas.sqlite`, which gives
 * the 2001 areas that split their 2011 successors.
 */
const ATLAS = join(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
	"data/build/atlas.sqlite",
);
const database = new DatabaseSync(ATLAS, { readOnly: true });
afterAll(() => database.close());

const one = (sql: string) =>
	Number((database.prepare(sql).get() as { n: number }).n);

test("every 2001 LSOA has a 2011 successor in the ONS lookup", () => {
	for (const release of ["2001-12-ew-bgc", "2001-12-ew-bgc-v2"]) {
		const slug = `lsoa-${release}-to-2011-12-ew-bgc-v3-official-lookup`;
		assert.equal(
			one(`SELECT count(DISTINCT e.from_version_id) AS n
				 FROM crosswalk_edge e JOIN crosswalk c ON c.id = e.crosswalk_id
				 WHERE c.slug = '${slug}'`),
			34378,
		);
		// 383 areas split, so a source can have several successors.
		assert.equal(
			one(`SELECT count(*) AS n FROM (
				 SELECT e.from_version_id FROM crosswalk_edge e
				 JOIN crosswalk c ON c.id = e.crosswalk_id
				 WHERE c.slug = '${slug}'
				 GROUP BY 1 HAVING count(*) > 1)`),
			383,
		);
	}
});

test("the 2001 to 2011 LSOA splits are change events", () => {
	assert.ok(
		one(`SELECT count(*) AS n FROM area_change_event e
			 JOIN area_release f ON f.id = e.from_release_id
			 JOIN area_release t ON t.id = e.to_release_id
			 WHERE f.geography = 'lsoa' AND f.release LIKE '2001-%'
			   AND t.release = '2011-12-ew-bgc-v3' AND e.kind = 'split'
			   AND e.basis = 'official-lookup'`) > 300,
	);
});
