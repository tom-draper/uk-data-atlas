import assert from "node:assert/strict";
import test from "node:test";
import { withAliases } from "../src/catalog/measureAliases";
import type { DataCatalog } from "../src/dataCatalog";
import { measureSlug, searchMeasures } from "../src/measureTerms";
import {
	dataCatalog,
	measureObservations,
	routeWithCatalog,
} from "./routeFixtures";

const aliases = {
	"population-estimate": "population",
	"house-prices": "house-price-median",
};

const catalog: DataCatalog = {
	...dataCatalog,
	measures: withAliases(dataCatalog.measures, aliases),
};

const get = (url: string) =>
	routeWithCatalog(url, catalog, measureObservations);

const ids = (response: ReturnType<typeof get>) =>
	"data" in response.body
		? (response.body.data as Array<{ id: string }>).map(({ id }) => id)
		: undefined;

test("reads a term as a plain slug", () => {
	assert.equal(measureSlug("  House Prices "), "house-prices");
	assert.equal(measureSlug("Ynys Môn_GDP"), "ynys-mon-gdp");
});

test("attaches reviewed aliases and refuses any that could be misread", () => {
	assert.deepEqual(
		catalog.measures.find(({ id }) => id === "population")?.aliases,
		["population-estimate"],
	);
	assert.throws(
		() =>
			withAliases(dataCatalog.measures, { population: "ghg-emissions" }),
		/already a measure id/,
	);
	assert.throws(
		() => withAliases(dataCatalog.measures, { people: "nobody" }),
		/not published/,
	);
	assert.throws(
		() =>
			withAliases(dataCatalog.measures, { "House prices": "population" }),
		/not a plain slug/,
	);
});

test("finds measures by the words people use, best first", () => {
	assert.equal(
		searchMeasures(catalog, "house prices")[0]?.id,
		"house-price-median",
	);
	assert.equal(searchMeasures(catalog, "Population")[0]?.id, "population");
	assert.deepEqual(searchMeasures(catalog, "no such thing"), []);
	assert.equal(searchMeasures(catalog, "  ").length, catalog.measures.length);

	const found = get("/v1/measures?q=house%20prices");
	assert.equal(found.status, 200);
	assert.equal(ids(found)?.[0], "house-price-median");
	// A search that matches nothing is an answer, not a refusal.
	const none = get("/v1/measures?q=unicorns");
	assert.equal(none.status, 200);
	assert.deepEqual(ids(none), []);
});

test("accepts an alias wherever a measure id is, and says what it read", () => {
	const measure = get("/v1/measures/population-estimate");
	assert.equal(measure.status, 200);
	assert.equal(
		"data" in measure.body && (measure.body.data as { id: string }).id,
		"population",
	);
	assert.equal(
		measure.headers?.["content-location"],
		"/v1/measures/population",
	);

	// A spelling people type, with a space and capitals, is read the same way.
	const typed = get("/v1/measures/House%20Prices");
	assert.equal(typed.status, 200);
	assert.equal(
		typed.headers?.["content-location"],
		"/v1/measures/house-price-median",
	);

	// A measure named in the query string is read the same way.
	const query = get("/v1/attribution?measure=population-estimate");
	assert.equal(
		query.headers?.["content-location"],
		"/v1/attribution?measure=population",
	);

	// An id is served as it is, and an unknown name is still unknown.
	assert.equal(get("/v1/measures/population").headers, undefined);
	const unknown = get("/v1/measures/unicorns");
	assert.equal(unknown.status, 404);
	assert.equal(unknown.headers, undefined);
});
