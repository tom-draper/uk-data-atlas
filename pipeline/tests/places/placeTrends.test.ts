import assert from "node:assert/strict";
import { test } from "vitest";
import type { ReleaseValue } from "@uk-data-atlas/measures";
import {
	trendKind,
	trendStanding,
	type PlaceTrend,
	type PlaceTrendArea,
} from "@uk-data-atlas/catalogue/place-trends";
import { declaredTrends, pointOf } from "../../src/places/buildPlaceTrends";

const value = (fields: Partial<ReleaseValue>) =>
	({
		period: "2024",
		value: 1000.004,
		status: "published",
		method: "native",
		flags: [],
		...fields,
	}) as ReleaseValue;

const source = {
	release: "localAuthority:2023-12-uk-bgc",
} as ReleaseValue["source"];

test("a native value is published", () => {
	assert.deepEqual(
		pointOf(value({}), () => undefined),
		["2024", 1000, 0],
	);
});

test("an exact value matching the code's published figure is published", () => {
	const seen: string[] = [];
	const point = pointOf(
		value({ method: "exact", source }),
		(release, period) => {
			seen.push(`${release} ${period}`);
			return 1000;
		},
	);
	assert.equal(trendKind(point), "published");
	assert.deepEqual(seen, ["2023-12-uk-bgc 2024"]);
});

test("an exact value for an area its source release lacks is regrouped", () => {
	const point = pointOf(
		value({
			method: "exact",
			source,
			flags: ["area-not-on-source-release"],
		}),
		() => 1000,
	);
	assert.equal(trendKind(point), "regrouped");
});

test("an exact value that differs from the published figure is regrouped", () => {
	const point = pointOf(value({ method: "exact", source }), () => 990);
	assert.equal(trendKind(point), "regrouped");
});

test("a weighted value is estimated and keeps its bounds", () => {
	assert.deepEqual(
		pointOf(
			value({ method: "weighted", lower: 900, upper: 1100 }),
			() => 1000,
		),
		["2024", 1000, 2, 900, 1100],
	);
});

test("population is declared once across its publishers", () => {
	const population = declaredTrends().find(
		(trend) => trend.declaration.key === "population",
	);
	assert.ok(population);
	assert.deepEqual(population.datasets.sort(), [
		"population-council-scotland",
		"population-district-ni",
		"population-uk",
	]);
});

test("a dataset can declare several trends, each shared by key", () => {
	const trends = declaredTrends();
	const female = trends.find(
		(trend) => trend.declaration.key === "life-expectancy-female",
	);
	const male = trends.find(
		(trend) => trend.declaration.key === "life-expectancy-male",
	);
	assert.deepEqual(female?.datasets.sort(), [
		"life-expectancy",
		"life-expectancy-series",
	]);
	assert.deepEqual(male?.datasets, female?.datasets);
	const orders = trends.map((trend) => trend.declaration.order);
	assert.deepEqual(
		orders,
		[...orders].sort((a, b) => a - b),
	);
	assert.equal(new Set(orders).size, orders.length);
});

const area = (
	value: number,
	dataset = "population-uk",
	period = "2024",
): PlaceTrendArea => ({
	dataset,
	release: "2026-05-uk-bgc",
	points: [[period, value, 0]],
	events: [],
});

const trend: PlaceTrend = {
	label: "Population",
	areas: {
		E06000001: area(100),
		E06000002: area(500),
		E06000003: area(300),
		E06000004: area(200),
		E06000005: area(400),
		E06000006: area(600),
		E06000007: area(700, "population-uk", "2023"),
		E06000008: area(800, "population-other"),
		E08000001: area(900),
	},
};

test("a council ranks among the same kind on the same period and dataset", () => {
	const standing = trendStanding(trend, "E06000003");
	assert.ok(standing);
	assert.equal(standing.groupName, "unitary authorities in England");
	assert.equal(standing.rank, 4);
	assert.equal(standing.of, 6);
	assert.deepEqual(
		standing.peers.map((peer) => peer.code),
		["E06000002", "E06000005", "E06000003", "E06000004", "E06000001"],
	);
});

test("the peer window stays full at the top of the ranking", () => {
	const standing = trendStanding(trend, "E06000006");
	assert.equal(standing?.rank, 1);
	assert.deepEqual(
		standing?.peers.map((peer) => peer.rank),
		[1, 2, 3, 4, 5],
	);
});

test("an area outside the known groups has no standing", () => {
	assert.equal(trendStanding(trend, "X01000001"), undefined);
});
