import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import type { PlanEntry } from "../../src/conversion/convertedPlan.ts";
import type { Step } from "../../src/conversion/crosswalkSteps.ts";
import type { Resolver } from "../../src/conversion/pinnedRoutes.ts";
import type { Hop, Route } from "../../src/conversion/routes.ts";
import type { ConversionRule, MeasureRow } from "../../src/conversion/rules.ts";
import {
	bestRoute,
	planStandardReleases,
} from "../../src/conversion/standardPlan.ts";

const hop = (id: number, from: number, to: number, exact: boolean): Hop => ({
	fromRelease: from,
	toRelease: to,
	crosswalks: [id],
	reversed: false,
	exact,
});

test("the best route splits least, then is shortest, then sorts by key", () => {
	const splitting: Route = [hop(1, 1, 3, false)];
	const exactLong: Route = [hop(2, 1, 2, true), hop(3, 2, 3, true)];
	const exactLongTie: Route = [hop(2, 1, 2, true), hop(4, 2, 3, true)];
	assert.equal(bestRoute([splitting, exactLongTie, exactLong]), exactLong);
	assert.equal(bestRoute([exactLongTie, exactLong]), exactLong);
	assert.equal(bestRoute([]), undefined);
});

const releases = new Map([
	[1, { id: 1, geography: "localAuthority", release: "2024-05" }],
	[2, { id: 2, geography: "localAuthority", release: "2026-05" }],
	[3, { id: 3, geography: "ward", release: "2026-05" }],
]);
const routesBetween = new Map<string, Route[]>([
	["1>2", [[hop(10, 1, 2, true)]]],
	["2>3", []],
	["1>3", []],
]);
const missing = (blocked: number): Step =>
	({
		blocked: new Map(
			Array.from({ length: blocked }, (_, i) => [
				i,
				{ reason: "no-weight", targets: [] },
			]),
		),
	}) as unknown as Step;
const basesAsked: string[] = [];
const resolver = {
	releaseId: (key: string) =>
		[...releases.values()].find(
			(r) => `${r.geography}:${r.release}` === key,
		)!.id,
	crosswalkId: () => 10,
	router: {
		release: (id: number) => releases.get(id)!,
		crosswalk: () => ({ slug: "la-2024-05-to-2026-05" }),
		routes: (from: number, to: number) =>
			routesBetween.get(`${from}>${to}`) ?? [],
		hop: () => hop(10, 1, 2, true),
		step: (_hop: Hop, basis: string) => {
			basesAsked.push(basis);
			return missing(basis === "households" ? 2 : 0);
		},
	},
} as unknown as Resolver;

const measure = (id: number, slug: string): MeasureRow => ({
	id,
	slug,
	unit: "count",
	valueKind: "count",
	aggregation: "sum",
	numerator: null,
	denominator: null,
	weight: null,
});
const sum: ConversionRule = { rule: "sum", splitBasis: null, reason: "" };
const measures = new Map([
	["people", { measure: measure(1, "people"), rule: sum }],
	["households", { measure: measure(2, "households"), rule: sum }],
	[
		"rank",
		{
			measure: measure(3, "rank"),
			rule: { rule: "refuse", reason: "ordinal" } as ConversionRule,
		},
	],
]);

const database = new DatabaseSync(":memory:");
database.exec(`
	CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT);
	INSERT INTO dataset VALUES (1, 'census');
	INSERT INTO measure VALUES (1, 'people'), (2, 'households'), (3, 'rank');
	INSERT INTO series (dataset_id, measure_id, release_id, method) VALUES
		(1, 1, 1, 'published'), (1, 1, 1, 'published'),
		(1, 2, 1, 'published'), (1, 3, 1, 'published'),
		(1, 1, 2, 'published'),
		(1, 1, 1, 'converted');
`);

const standard = ["localAuthority:2026-05", "ward:2026-05"];

test("each standard release a series is not on gets an entry or a recorded skip", () => {
	const plan = planStandardReleases(
		database,
		resolver,
		measures,
		[],
		standard,
	);
	assert.deepEqual(
		plan.entries.map((entry) => entry.id),
		[
			"census/households@localAuthority:2024-05>localAuthority:2026-05",
			"census/people@localAuthority:2024-05>localAuthority:2026-05",
		],
	);
	assert.deepEqual(
		plan.skips.map(
			({ measure, source, target, reason, series }) =>
				`${measure} ${source} > ${target} ${reason} ${series}`,
		),
		[
			"households localAuthority:2024-05 > ward:2026-05 no-route 1",
			"people localAuthority:2024-05 > ward:2026-05 no-route 2",
			"people localAuthority:2026-05 > ward:2026-05 no-route 1",
			"rank localAuthority:2024-05 > localAuthority:2026-05 refused-measure 1",
			"rank localAuthority:2024-05 > ward:2026-05 refused-measure 1",
		],
	);
});

test("a measure's basis follows its subject, and falls back where its weights are missing", () => {
	const plan = planStandardReleases(
		database,
		resolver,
		measures,
		[],
		standard,
	);
	const basisOf = (slug: string) =>
		plan.entries.find((entry) => entry.source.measure === slug)!.basis;
	assert.equal(basisOf("people"), "population");
	// Households has no weights on its own basis in this route.
	assert.equal(basisOf("households"), "population");
});

test("a pinned entry replaces the generated one for its source and target", () => {
	const pinned: PlanEntry = {
		id: "census/people>la",
		source: {
			dataset: "census",
			measure: "people",
			release: "localAuthority:2024-05",
		},
		target: "localAuthority:2026-05",
		route: [{ crosswalks: ["pinned"] }],
		members: /sex=all$/,
		note: "Pinned.",
	};
	const plan = planStandardReleases(
		database,
		resolver,
		measures,
		[pinned],
		standard,
	);
	const entry = plan.entries.find((e) => e.id === pinned.id)!;
	assert.deepEqual(entry.route, pinned.route);
	assert.equal(entry.note, "Pinned.");
	assert.equal(
		plan.entries.filter((e) => e.source.measure === "people").length,
		1,
	);
});
