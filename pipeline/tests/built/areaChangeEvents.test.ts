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

test("only events with a successor are realigned, and redrawn ones keep their code", () => {
	// A lookup's split, merge or redistribution carries the flag when one of
	// its areas is also a realigned succession; an area that only ended or was
	// created, or only changed name, cannot be.
	assert.deepEqual(
		all(
			`SELECT id, kind FROM area_change_event
			WHERE realigned = 1 AND kind IN ('renamed', 'ended', 'created') LIMIT 5`,
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
	// Oldham's Alexandra ward was recoded in 2023 inside a redistribution the
	// Code History Database records for the whole authority.
	assert.ok(
		all(
			"SELECT 1 FROM v_area_change WHERE code = 'E05000719' AND side = 'from' AND kind = 'redistributed' AND basis = 'official-lookup' AND realigned = 1",
		).length > 0,
	);
	// Local authorities and LSOAs have splits from their official lookups.
	assert.ok(
		all(
			"SELECT 1 FROM v_area_change WHERE kind = 'split' AND geography = 'lsoa' AND effective_date = '2021-03-21' AND date_basis = 'legal' AND side = 'from'",
		).length > 800,
	);
});

test("a ward the Code History Database splits is a split, whose basis is the lookup", () => {
	const split = all(
		`SELECT code, side, basis, effective_date FROM v_area_change WHERE event_id IN
			(SELECT event_id FROM v_area_change WHERE code = 'E05008153' AND side = 'from' AND kind = 'split')
		ORDER BY side, code`,
	);
	assert.deepEqual(
		split.map((row) => ({ ...row })),
		[
			{
				code: "E05008153",
				side: "from",
				basis: "official-lookup",
				effective_date: "2025-05-01",
			},
			{
				code: "E05016036",
				side: "to",
				basis: "official-lookup",
				effective_date: "2025-05-01",
			},
			{
				code: "E05016076",
				side: "to",
				basis: "official-lookup",
				effective_date: "2025-05-01",
			},
		],
	);
});

test("an event the Code History Database dates has its legal date, and keeps the edition date", () => {
	// Cumberland took effect on 1 April 2023, a month before the 2023-05 edition.
	assert.deepEqual(
		all(
			`SELECT DISTINCT kind, effective_date, date_basis, edition_date FROM v_area_change
			WHERE event_id IN (SELECT event_id FROM v_area_change WHERE code = 'E07000026' AND side = 'from')`,
		).map((row) => ({ ...row })),
		[
			{
				kind: "merged",
				effective_date: "2023-04-01",
				date_basis: "legal",
				edition_date: "2023-05-01",
			},
		],
	);
	// A rename or a redraw has no operative date, so it keeps its edition date.
	assert.deepEqual(
		all(
			`SELECT count(*) AS n FROM area_change_event
			WHERE kind IN ('renamed', 'redrawn') AND date_basis <> 'edition'`,
		).map((row) => ({ ...row })),
		[{ n: 0 }],
	);
});

test("a legal date lies between the earlier edition and the end of the later edition's month", () => {
	const problems = all(
		`SELECT e.id, e.effective_date, e.edition_date, fe.edition_from AS earlier
		FROM area_change_event e
		JOIN area_release fr ON fr.id = e.from_release_id
		JOIN boundary_release_edition fe ON fe.geography = fr.geography AND fe.release = fr.release
		WHERE e.date_basis = 'legal'
			AND (e.effective_date < fe.edition_from
				OR e.effective_date > date(e.edition_date, 'start of month', '+1 month', '-1 day'))`,
	);
	assert.deepEqual(problems, []);
	// An event with an edition basis has the edition date and nothing else.
	assert.deepEqual(
		all(
			"SELECT count(*) AS n FROM area_change_event WHERE date_basis = 'edition' AND effective_date <> edition_date",
		).map((row) => ({ ...row })),
		[{ n: 0 }],
	);
});

test("the Code History Database dates most events of the geographies it covers", () => {
	// Renamed and redrawn events have no operative date to match, so they are left out.
	const rates = Object.fromEntries(
		all(
			`SELECT g.slug AS geography, count(*) AS events,
				sum(e.date_basis = 'legal') AS legal
			FROM area_change_event e JOIN geography g ON g.id = e.geography_id
			WHERE e.kind NOT IN ('renamed', 'redrawn')
			GROUP BY g.slug`,
		).map((row) => [row.geography, Number(row.legal) / Number(row.events)]),
	);
	assert.ok(rates.ward! > 0.9, `ward ${rates.ward}`);
	assert.ok(rates.outputArea! > 0.9, `output area ${rates.outputArea}`);
	assert.ok(rates.parish! > 0.8, `parish ${rates.parish}`);
	assert.ok(rates.constituency! > 0.7, `constituency ${rates.constituency}`);
	// The database does not cover these, so they keep their edition dates.
	assert.equal(rates.itl3, 0);
	assert.equal(rates.scottishParliamentaryConstituency, 0);
});

test("ward changes are mostly splits, merges and redistributions, not ended and created pairs", () => {
	const counts = Object.fromEntries(
		all(
			`SELECT kind, count(*) AS n FROM area_change_event
			WHERE geography_id = (SELECT id FROM geography WHERE slug = 'ward') GROUP BY kind`,
		).map((row) => [row.kind, Number(row.n)]),
	);
	assert.ok((counts.merged ?? 0) > 200, `${counts.merged} merges`);
	assert.ok((counts.split ?? 0) > 20, `${counts.split} splits`);
	assert.ok(
		(counts.redistributed ?? 0) > 1000,
		`${counts.redistributed} redistributions`,
	);
	// What the lookups cannot place stays ended or created, and is small.
	assert.ok((counts.ended ?? 0) < 200, `${counts.ended} ended`);
	assert.ok((counts.created ?? 0) < 200, `${counts.created} created`);
});

test("output area, LSOA, MSOA, parish and local authority changes are splits and merges, not ended and created pairs", () => {
	const count = (geography: string, kinds: string) =>
		Number(
			all(
				`SELECT count(*) AS n FROM area_change_event
				WHERE geography_id = (SELECT id FROM geography WHERE slug = '${geography}')
					AND kind IN (${kinds})`,
			)[0]!.n,
		);
	const place = "'split', 'merged', 'redistributed'";
	const unplaced = "'ended', 'created'";
	// The 2011 to 2021 censuses split thousands of output areas and hundreds of LSOAs.
	assert.ok(count("outputArea", "'split'") > 5000, "output area splits");
	assert.ok(count("outputArea", "'merged'") > 500, "output area merges");
	assert.ok(count("lsoa", "'split'") > 1000, "LSOA splits");
	assert.ok(count("msoa", "'split'") > 50, "MSOA splits");
	assert.ok(count("parish", "'merged'") > 10, "parish merges");
	assert.ok(
		count("localAuthority", "'merged'") > 10,
		"local authority merges",
	);
	// What the Code History Database cannot place stays ended or created, and is small.
	for (const geography of [
		"outputArea",
		"lsoa",
		"msoa",
		"parish",
		"localAuthority",
	])
		assert.ok(
			count(geography, unplaced) < count(geography, place) / 5 + 10,
			`${geography} ended or created events outnumber its placed ones`,
		);
});

test("an event's basis is the lookup unless only an extent-continuity crosswalk made it", () => {
	const problems = all(
		`SELECT e.id, e.basis, c.method FROM area_change_event e
		JOIN crosswalk c ON c.id = e.crosswalk_id
		WHERE (c.method = 'extent-continuity' AND e.basis <> 'extent-continuity')
			OR (c.method = 'clean-containment' AND e.basis <> 'clean-containment')
			OR (c.method = 'official-lookup' AND e.basis NOT IN ('official-lookup', 'extent-continuity'))
		LIMIT 5`,
	);
	assert.deepEqual(problems, []);
	assert.deepEqual(
		all(
			"SELECT id FROM area_change_event WHERE source = 'publisher' AND basis <> 'publisher-statement' LIMIT 5",
		),
		[],
	);
	assert.deepEqual(
		all(
			`SELECT id FROM area_change_event WHERE kind IN ('split', 'merged', 'redistributed')
				AND basis = 'extent-continuity' LIMIT 5`,
		),
		[],
	);
});
