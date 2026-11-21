import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";
import {
	followLineage,
	LINEAGE_GEOGRAPHIES,
	type AreaLineage,
} from "@uk-data-atlas/geography";
import { readAtlasAssetText } from "@uk-data-atlas/atlas-db";
import { readAreaLineages } from "../../src/atlas/buildAtlasAssets";

/**
 * The area lineage the website reads (`website-assets.sqlite`) against the
 * change events it was compiled from (`atlas.sqlite`). Both come from
 * `pnpm data:build --only website-lookups`.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const database = new DatabaseSync(join(ROOT, "data/build/atlas.sqlite"), {
	readOnly: true,
});
afterAll(() => database.close());

const lineages = JSON.parse(
	readAtlasAssetText(ROOT, "lookups", "area-lineage"),
) as Record<string, AreaLineage>;

test("the website's lineage is the one the change events compile to", () => {
	assert.deepEqual(lineages, readAreaLineages(ROOT));
	assert.deepEqual(
		Object.keys(lineages).sort(),
		[...LINEAGE_GEOGRAPHIES].sort(),
	);
});

test("a renamed or recoded area follows to the area the event names", () => {
	const problems: string[] = [];
	let checked = 0;
	const rows = database
		.prepare(
			`SELECT g.slug AS geography, fr.release AS from_release, tr.release AS to_release,
				f.code AS from_code, t.code AS to_code
			FROM area_change_event e
			JOIN geography g ON g.id = e.geography_id
			JOIN area_release fr ON fr.id = e.from_release_id
			JOIN area_release tr ON tr.id = e.to_release_id
			JOIN area_change_member fm ON fm.event_id = e.id AND fm.side = 'from'
			JOIN area_version fv ON fv.id = fm.area_version_id
			JOIN area f ON f.id = fv.area_id
			JOIN area_change_member tm ON tm.event_id = e.id AND tm.side = 'to'
			JOIN area_version tv ON tv.id = tm.area_version_id
			JOIN area t ON t.id = tv.area_id
			WHERE e.kind IN ('renamed', 'recoded')`,
		)
		.all() as Array<{
		geography: string;
		from_release: string;
		to_release: string;
		from_code: string;
		to_code: string;
	}>;
	for (const row of rows) {
		const lineage = lineages[row.geography];
		if (
			!lineage ||
			!lineage.releases.includes(row.from_release) ||
			!lineage.releases.includes(row.to_release)
		)
			continue;
		checked += 1;
		const answer = followLineage(
			lineage,
			row.from_code,
			row.from_release,
			row.to_release,
		);
		if (answer !== row.to_code)
			problems.push(
				`${row.geography} ${row.from_release}>${row.to_release} ${row.from_code}: ${answer} not ${row.to_code}`,
			);
	}
	assert.ok(checked > 30, `${checked} events were checked`);
	assert.deepEqual(problems.slice(0, 5), []);
});

test("an area an event ends has no successor in the next release", () => {
	const problems: string[] = [];
	let checked = 0;
	const rows = database
		.prepare(
			`SELECT g.slug AS geography, fr.release AS from_release, tr.release AS to_release, a.code
			FROM area_change_event e
			JOIN geography g ON g.id = e.geography_id
			JOIN area_release fr ON fr.id = e.from_release_id
			JOIN area_release tr ON tr.id = e.to_release_id
			JOIN area_change_member m ON m.event_id = e.id AND m.side = 'from'
			JOIN area_version v ON v.id = m.area_version_id
			JOIN area a ON a.id = v.area_id
			WHERE e.kind = 'ended'`,
		)
		.all() as Array<{
		geography: string;
		from_release: string;
		to_release: string;
		code: string;
	}>;
	for (const row of rows) {
		const lineage = lineages[row.geography];
		if (
			!lineage ||
			!lineage.releases.includes(row.from_release) ||
			!lineage.releases.includes(row.to_release)
		)
			continue;
		checked += 1;
		const answer = followLineage(
			lineage,
			row.code,
			row.from_release,
			row.to_release,
		);
		if (answer !== undefined)
			problems.push(
				`${row.geography} ${row.from_release}>${row.to_release} ${row.code}: ${answer}`,
			);
	}
	assert.ok(checked > 30, `${checked} events were checked`);
	assert.deepEqual(problems.slice(0, 5), []);
});
