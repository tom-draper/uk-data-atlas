import assert from "node:assert/strict";
import test from "node:test";
import { parseAggregateQuery } from "../src/aggregateQuery";
import { createGeographyResolver } from "../src/geographyResolver";
import { dataCatalog } from "./routeFixtures";

const geographyResolver = createGeographyResolver({});

const url = (query: string) =>
	new URL(`https://api.example.test/v1/data/measure/aggregate?${query}`);

test("parses a country aggregation query", () => {
	assert.deepEqual(
		parseAggregateQuery({
			parsedUrl: url(
				"period=2024&geography=localAuthority&boundaryYear=2024&place=E92000001",
			),
			measureId: "measure.example",
			measure: dataCatalog.measures[0]!,
			geographyResolver,
		}),
		{
			period: "2024",
			geography: "localAuthority",
			boundaryYear: "2024",
			locationId: null,
			areaCode: "E92000001",
			targetCode: null,
			targetGeography: null,
			crosswalkId: null,
			pathId: null,
			from: null,
			defaulted: {},
		},
	);
});

test("reads a place reference's geography as the target's", () => {
	const result = parseAggregateQuery({
		parsedUrl: url(
			"period=2024&geography=localAuthority&boundaryYear=2024&place=region/R1&crosswalk=x&from=localAuthority/release",
		),
		measureId: "measure.example",
		measure: dataCatalog.measures[0]!,
		geographyResolver,
	});
	assert.equal("status" in result, false);
	if ("status" in result) return;
	assert.equal(result.targetGeography, "region");
	assert.equal(result.targetCode, "R1");
	assert.equal(result.crosswalkId, "x");
	assert.deepEqual(result.from, {
		geography: "localAuthority",
		boundaryRelease: "release",
	});
});

test("rejects unsupported selectors and malformed targets", () => {
	const conversion = parseAggregateQuery({
		parsedUrl: url(
			"period=2024&geography=localAuthority&boundaryYear=2024&place=E92000001&conversion=x",
		),
		measureId: "measure.example",
		measure: dataCatalog.measures[0]!,
		geographyResolver,
	});
	assert.equal("status" in conversion ? conversion.status : undefined, 422);

	const invalidCountry = parseAggregateQuery({
		parsedUrl: url(
			"period=2024&geography=localAuthority&boundaryYear=2024&place=E1",
		),
		measureId: "measure.example",
		measure: dataCatalog.measures[0]!,
		geographyResolver,
	});
	assert.equal(
		"status" in invalidCountry ? invalidCountry.status : undefined,
		400,
	);

	const missingSource = parseAggregateQuery({
		parsedUrl: url("place=E92000001"),
		measureId: "measure.example",
		measure: dataCatalog.measures[0]!,
		geographyResolver,
	});
	assert.equal(
		"status" in missingSource ? missingSource.status : undefined,
		400,
	);
});
