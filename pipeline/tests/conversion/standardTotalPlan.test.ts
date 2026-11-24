import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import type { Resolver } from "../../src/conversion/pinnedRoutes.ts";
import type { Hop, Route } from "../../src/conversion/routes.ts";
import {
	planPopulationReleases,
	STANDARD_RELEASES,
	STANDARD_TOTAL_DATASETS,
} from "../../src/conversion/standardPlan.ts";

const releases = new Map([
	[1, { id: 1, geography: "ward", release: "2023-12" }],
	[2, { id: 2, geography: "localAuthority", release: "2023-12" }],
	[3, { id: 3, geography: "localAuthority", release: "2026-05-uk-bgc" }],
	[4, { id: 4, geography: "ward", release: "2026-05-uk-bgc" }],
	[5, { id: 5, geography: "constituency", release: "2024-07-uk-bgc" }],
	[6, { id: 6, geography: "localAuthority", release: "2015-12" }],
]);
const hop = (from: number, to: number): Hop => ({
	fromRelease: from,
	toRelease: to,
	crosswalks: [from * 10 + to],
	reversed: false,
	exact: false,
});
// Every release is reached from the councils and the wards.
const resolver = {
	releaseId: (key: string) =>
		[...releases.values()].find(
			(r) => `${r.geography}:${r.release}` === key,
		)!.id,
	router: {
		release: (id: number) => releases.get(id)!,
		crosswalk: (id: number) => ({ slug: `crosswalk-${id}` }),
		routes: (from: number, to: number): Route[] =>
			from === to ? [] : [[hop(from, to)]],
	},
} as unknown as Resolver;

const database = new DatabaseSync(":memory:");
database.exec(`
	CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
	CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT);
	INSERT INTO area_release VALUES
		(1, 'ward', '2023-12'), (2, 'localAuthority', '2023-12'),
		(3, 'localAuthority', '2026-05-uk-bgc'), (4, 'ward', '2026-05-uk-bgc'),
		(5, 'constituency', '2024-07-uk-bgc'), (6, 'localAuthority', '2015-12');
	INSERT INTO dataset VALUES
		(1, 'population'), (2, 'population-council-scotland'),
		(3, 'population-district-ni'), (4, 'population-uk');
	INSERT INTO measure VALUES (1, 'population');
	INSERT INTO series VALUES
		(1, 1, 1, 1, 'published'),
		(2, 2, 1, 2, 'published'),
		(3, 3, 1, 2, 'published'),
		(4, 4, 1, 2, 'published');
`);

const standard = new Set<string>(STANDARD_RELEASES);
const targetsOf = (
	dataset: string,
	plan = planPopulationReleases(database, resolver),
) =>
	plan.entries
		.filter((entry) => entry.source.dataset === dataset)
		.map((entry) => entry.target);

test("the nation council files are also offered their total on the standard releases", () => {
	for (const dataset of STANDARD_TOTAL_DATASETS) {
		const targets = targetsOf(dataset);
		for (const target of [
			"localAuthority:2026-05-uk-bgc",
			"ward:2026-05-uk-bgc",
			"constituency:2024-07-uk-bgc",
		])
			assert.ok(targets.includes(target), `${dataset} reaches ${target}`);
		assert.ok(targets.includes("localAuthority:2015-12"));
	}
});

test("no other dataset is offered a standard release, so England and Wales keep their values", () => {
	for (const dataset of ["population", "population-uk"])
		assert.ok(
			targetsOf(dataset).every((target) => !standard.has(target)),
			`${dataset} stays off the standard releases`,
		);
});

test("the totals on the standard releases are persons of all ages, summed from the single years", () => {
	const plan = planPopulationReleases(database, resolver);
	const entry = plan.entries.find(
		(held) =>
			held.source.dataset === "population-council-scotland" &&
			held.target === "localAuthority:2026-05-uk-bgc",
	)!;
	assert.equal(
		entry.id,
		"population-council-scotland/population@localAuthority:2023-12>localAuthority:2026-05-uk-bgc#total",
	);
	assert.equal(entry.total, true);
	assert.equal(entry.basis, "population");
	assert.match(entry.note ?? "", /sum of the single years of age/);
});

test("a plan with no standard totals leaves the standard releases out, as before", () => {
	const plan = planPopulationReleases(
		database,
		resolver,
		undefined,
		undefined,
		[],
	);
	for (const dataset of STANDARD_TOTAL_DATASETS)
		assert.ok(
			targetsOf(dataset, plan).every((target) => !standard.has(target)),
		);
});
