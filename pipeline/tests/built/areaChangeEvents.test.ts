import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";
import { selectIdentityCrosswalks } from "../../src/storage/areaChangeEvents";

/**
 * The change events in the built `atlas.sqlite`
 * (`pnpm data:build --only assemble-atlas`) against the identity crosswalks
 * they were read from.
 */
const ATLAS = join(
	resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
	"data/build/atlas.sqlite",
);
const database = new DatabaseSync(ATLAS, { readOnly: true });
afterAll(() => database.close());

const all = (sql: string, ...values: number[]) =>
	database.prepare(sql).all(...values);

test("every changed link of an identity crosswalk is in exactly one event", () => {
	const crosswalks = selectIdentityCrosswalks(database);
	assert.ok(crosswalks.length > 50);
	const problems: string[] = [];
	for (const { id } of crosswalks) {
		// A link is unchanged when its two areas share code and name and
		// neither has another link. Every other link must be in one event,
		// with its from area and its to area both members of it.
		const links = all(
			`SELECT e.from_version_id AS f, e.to_version_id AS t
			FROM crosswalk_edge e
			JOIN area_version fv ON fv.id = e.from_version_id
			JOIN area_version tv ON tv.id = e.to_version_id
			WHERE e.crosswalk_id = ?
				AND NOT (fv.area_id = tv.area_id AND fv.name = tv.name
					AND (SELECT count(*) FROM crosswalk_edge o WHERE o.crosswalk_id = e.crosswalk_id AND o.from_version_id = e.from_version_id) = 1
					AND (SELECT count(*) FROM crosswalk_edge o WHERE o.crosswalk_id = e.crosswalk_id AND o.to_version_id = e.to_version_id) = 1)`,
			id,
		) as Array<{ f: number; t: number }>;
		const held = new Map<string, number>();
		for (const row of all(
			`SELECT f.area_version_id AS f, t.area_version_id AS t, f.event_id
			FROM area_change_event e
			JOIN area_change_member f ON f.event_id = e.id AND f.side = 'from'
			JOIN area_change_member t ON t.event_id = e.id AND t.side = 'to'
			WHERE e.crosswalk_id = ?`,
			id,
		) as Array<{ f: number; t: number; event_id: number }>)
			held.set(
				`${row.f}|${row.t}`,
				(held.get(`${row.f}|${row.t}`) ?? 0) + 1,
			);
		for (const { f, t } of links)
			if (held.get(`${f}|${t}`) !== 1)
				problems.push(
					`crosswalk ${id}: link ${f} to ${t} is in ${held.get(`${f}|${t}`) ?? 0} events`,
				);
	}
	assert.deepEqual(problems.slice(0, 5), []);
});

test("an earlier area is a from member of at most one event per crosswalk", () => {
	assert.deepEqual(
		all(
			`SELECT e.crosswalk_id, m.area_version_id FROM area_change_event e
			JOIN area_change_member m ON m.event_id = e.id AND m.side = 'from'
			WHERE e.crosswalk_id IS NOT NULL
			GROUP BY e.crosswalk_id, m.area_version_id HAVING count(*) > 1 LIMIT 5`,
		),
		[],
	);
});

test("event ids are numbered in order and every event has members", () => {
	const ids = all("SELECT id FROM area_change_event ORDER BY id") as Array<{
		id: number;
	}>;
	assert.ok(ids.length > 1000);
	assert.deepEqual(
		ids.map((row) => row.id),
		ids.map((_, index) => index + 1),
	);
	assert.deepEqual(
		all(
			"SELECT id FROM area_change_event WHERE id NOT IN (SELECT event_id FROM area_change_member) LIMIT 5",
		),
		[],
	);
});

test("the kind matches the members on each side", () => {
	assert.deepEqual(
		all(
			`WITH n AS (
				SELECT e.id, e.kind,
					sum(m.side = 'from') AS froms, sum(m.side = 'to') AS tos
				FROM area_change_event e JOIN area_change_member m ON m.event_id = e.id GROUP BY e.id)
			SELECT id, kind, froms, tos FROM n WHERE NOT (
				(kind IN ('renamed', 'recoded', 'redrawn') AND froms = 1 AND tos = 1)
				OR (kind = 'split' AND froms = 1 AND tos > 1)
				OR (kind = 'merged' AND froms > 1 AND tos = 1)
				OR (kind = 'redistributed' AND froms > 1 AND tos > 1)
				OR (kind = 'ended' AND froms = 1 AND tos = 0)
				OR (kind = 'created' AND froms = 0 AND tos = 1)) LIMIT 5`,
		),
		[],
	);
});

test("only recoded and redrawn events are realigned, and redrawn ones keep their code", () => {
	assert.deepEqual(
		all(
			`SELECT id, kind FROM area_change_event
			WHERE realigned = 1 AND kind NOT IN ('recoded', 'redrawn') LIMIT 5`,
		),
		[],
	);
	assert.deepEqual(
		all(
			`SELECT e.id FROM area_change_event e
			JOIN area_change_member f ON f.event_id = e.id AND f.side = 'from'
			JOIN area_change_member t ON t.event_id = e.id AND t.side = 'to'
			JOIN area_version fv ON fv.id = f.area_version_id
			JOIN area_version tv ON tv.id = t.area_version_id
			WHERE e.kind = 'redrawn' AND fv.area_id <> tv.area_id LIMIT 5`,
		),
		[],
	);
	assert.ok(
		all(
			"SELECT 1 FROM area_change_event WHERE kind = 'redrawn' AND realigned = 1",
		).length > 0,
	);
});

test("the LSOA 2011 to 2021 events agree with the lookup's change flag", () => {
	// An event's kind is a change flag too: renamed and recoded links are
	// 'unchanged' in the lookup, which says nothing about names or codes.
	const flag: Record<string, string> = {
		renamed: "unchanged",
		recoded: "unchanged",
		split: "split",
		merged: "merged",
		redistributed: "complex",
	};
	const rows = all(
		`SELECT e.id, e.kind, x.change
		FROM crosswalk c
		JOIN area_release r ON r.id = c.from_release_id
		JOIN area_change_event e ON e.crosswalk_id = c.id
		JOIN area_change_member f ON f.event_id = e.id AND f.side = 'from'
		JOIN crosswalk_edge x ON x.crosswalk_id = c.id AND x.from_version_id = f.area_version_id
		WHERE c.slug = 'lsoa-2011-12-ew-bgc-v3-to-2021-12-ew-bgc-v5-official-lookup'`,
	) as Array<{ id: number; kind: string; change: string }>;
	assert.ok(rows.length > 2000);
	const differences = rows.filter((row) => flag[row.kind] !== row.change);
	assert.deepEqual(differences.slice(0, 5), []);
	// Links the lookup flags as changed must all have an event.
	assert.deepEqual(
		all(
			`SELECT x.from_version_id FROM crosswalk c JOIN crosswalk_edge x ON x.crosswalk_id = c.id
			WHERE c.slug = 'lsoa-2011-12-ew-bgc-v3-to-2021-12-ew-bgc-v5-official-lookup'
				AND x.change <> 'unchanged'
				AND NOT EXISTS (SELECT 1 FROM area_change_event e
					JOIN area_change_member m ON m.event_id = e.id AND m.side = 'from'
					WHERE e.crosswalk_id = c.id AND m.area_version_id = x.from_version_id) LIMIT 5`,
		),
		[],
	);
});

test("Allerdale, a 2022 ward and the 2023 splits are each one query", () => {
	const replaced = all(
		`SELECT code, side FROM v_area_change WHERE event_id IN
			(SELECT event_id FROM v_area_change WHERE code = 'E07000026' AND side = 'from') ORDER BY side, code`,
	);
	assert.deepEqual(
		replaced.map((row) => ({ ...row })),
		[
			{ code: "E07000026", side: "from" },
			{ code: "E07000028", side: "from" },
			{ code: "E07000029", side: "from" },
			{ code: "E06000063", side: "to" },
		],
	);
	assert.ok(
		all(
			"SELECT 1 FROM v_area_change WHERE code = 'E05000719' AND side = 'from' AND kind = 'recoded'",
		).length > 0,
	);
	// Ward crosswalks that are not official lookups cannot see a split, so
	// there are none in 2023. Local authorities do have them.
	assert.ok(
		all(
			"SELECT 1 FROM v_area_change WHERE kind = 'split' AND geography = 'lsoa' AND effective_date = '2021-12-01' AND side = 'from'",
		).length > 800,
	);
});
