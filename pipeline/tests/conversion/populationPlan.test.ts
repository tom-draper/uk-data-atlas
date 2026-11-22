import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { MAX_CHAIN_HOPS } from "../../src/conversion/chains.ts";
import type { Resolver } from "../../src/conversion/pinnedRoutes.ts";
import type { Hop, Route } from "../../src/conversion/routes.ts";
import { planPopulationReleases } from "../../src/conversion/standardPlan.ts";

const releases = new Map([
	[1, { id: 1, geography: "ward", release: "2023-12" }],
	[2, { id: 2, geography: "localAuthority", release: "2023-12" }],
	[3, { id: 3, geography: "localAuthority", release: "2026-05" }],
	[4, { id: 4, geography: "ward", release: "2015-12" }],
	[5, { id: 5, geography: "localAuthority", release: "2015-12" }],
	[6, { id: 6, geography: "constituency", release: "2024-07" }],
	[7, { id: 7, geography: "lsoa", release: "2021-12" }],
]);
const hop = (from: number, to: number): Hop => ({
	fromRelease: from,
	toRelease: to,
	crosswalks: [from * 10 + to],
	reversed: false,
	exact: false,
});
// Wards reach every release; councils and constituencies reach no other.
const routed = new Set(["1>2", "1>3", "1>4", "1>5", "1>6"]);
const hopsAsked: number[] = [];
const resolver = {
	releaseId: (key: string) =>
		[...releases.values()].find(
			(r) => `${r.geography}:${r.release}` === key,
		)!.id,
	router: {
		release: (id: number) => releases.get(id)!,
		crosswalk: (id: number) => ({ slug: `crosswalk-${id}` }),
		routes: (from: number, to: number, hops: number): Route[] => {
			hopsAsked.push(hops);
			return routed.has(`${from}>${to}`) ? [[hop(from, to)]] : [];
		},
	},
} as unknown as Resolver;

const database = new DatabaseSync(":memory:");
database.exec(`
	CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
	CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT);
	CREATE TABLE observation (series_id INTEGER, period_id INTEGER);
	INSERT INTO area_release VALUES
		(1, 'ward', '2023-12'), (2, 'localAuthority', '2023-12'),
		(3, 'localAuthority', '2026-05'), (4, 'ward', '2015-12'),
		(5, 'localAuthority', '2015-12'), (6, 'constituency', '2024-07'),
		(7, 'lsoa', '2021-12');
	INSERT INTO dataset VALUES
		(1, 'population'), (2, 'population-uk'),
		(3, 'population-constituency'), (4, 'imd');
	INSERT INTO measure VALUES (1, 'population'), (2, 'households');
	INSERT INTO series VALUES
		(1, 1, 1, 1, 'published'),
		(2, 2, 1, 2, 'published'),
		(3, 3, 1, 6, 'published'),
		(4, 4, 1, 7, 'published'),
		(5, 1, 2, 1, 'published'),
		(6, 1, 1, 5, 'converted');
	INSERT INTO observation VALUES
		(1, 2022), (2, 2021), (2, 2022), (3, 2022), (4, 2019), (5, 2022), (6, 2022);
`);

const plan = planPopulationReleases(database, resolver, undefined, [
	"localAuthority:2026-05",
	"constituency:2024-07",
]);
const skips = plan.skips.map(
	({ dataset, source, target, reason }) =>
		`${dataset} ${source} > ${target} ${reason}`,
);

test("every held year of population is offered every release its source reaches", () => {
	assert.deepEqual(
		plan.entries.map((entry) => entry.id),
		[
			"population/population@ward:2023-12>localAuthority:2015-12#total",
			"population/population@ward:2023-12>localAuthority:2023-12#total",
			"population/population@ward:2023-12>ward:2015-12#total",
		],
	);
	for (const entry of plan.entries) {
		assert.equal(entry.total, true);
		assert.equal(entry.estimates, true);
		assert.equal(entry.basis, "population");
		assert.ok(entry.members?.test("age=4/sex=all"));
		assert.ok(!entry.members?.test("age=4/sex=male"));
	}
	assert.ok(hopsAsked.every((hops) => hops === MAX_CHAIN_HOPS));
});

test("the standard releases, other geographies and other datasets are not offered", () => {
	const targets = new Set([
		...plan.entries.map((entry) => entry.target),
		...plan.skips.map((skip) => skip.target),
	]);
	assert.ok(!targets.has("localAuthority:2026-05"));
	assert.ok(!targets.has("constituency:2024-07"));
	assert.ok(!targets.has("lsoa:2021-12"));
	assert.ok(!skips.some((skip) => skip.startsWith("imd ")));
});

test("a coarser source is skipped where finer ones already reach all its years", () => {
	// The constituency years are all reached from the wards.
	assert.ok(
		skips.includes(
			"population-constituency constituency:2024-07 > localAuthority:2015-12 better-route",
		),
	);
	// The council years are not, so it is offered, and has no route back.
	assert.ok(
		skips.includes(
			"population-uk localAuthority:2023-12 > localAuthority:2015-12 no-route",
		),
	);
	assert.ok(
		skips.includes("population-uk localAuthority:2023-12 > ward:2015-12 no-route"),
	);
});
