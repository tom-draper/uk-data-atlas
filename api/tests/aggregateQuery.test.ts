import assert from "node:assert/strict";
import test from "node:test";
import { parseAggregateQuery } from "../src/aggregateQuery";

const url = (query: string) =>
	new URL(`https://api.example.test/v1/data/measure/aggregate?${query}`);

test("parses a country aggregation query", () => {
	assert.deepEqual(
		parseAggregateQuery({
			parsedUrl: url(
				"period=2024&geography=localAuthority&boundaryYear=2024&areaCode=E92000001",
			),
			measureId: "measure.example",
		}),
		{
			period: "2024",
			geography: "localAuthority",
			boundaryYear: "2024",
			locationId: null,
			areaCode: "E92000001",
			regionCode: null,
			targetCode: null,
			crosswalkId: null,
			pathId: null,
			sourceRelease: null,
		},
	);
});

test("keeps the legacy regionCode alias", () => {
	const result = parseAggregateQuery({
		parsedUrl: url(
			"period=2024&geography=localAuthority&boundaryYear=2024&regionCode=R1&crosswalk=x&sourceRelease=release",
		),
		measureId: "measure.example",
	});
	assert.equal("status" in result, false);
	if ("status" in result) return;
	assert.equal(result.regionCode, "R1");
	assert.equal(result.targetCode, "R1");
	assert.equal(result.crosswalkId, "x");
	assert.equal(result.sourceRelease, "release");
});

test("rejects unsupported selectors and malformed targets", () => {
	const conversion = parseAggregateQuery({
		parsedUrl: url(
			"period=2024&geography=localAuthority&boundaryYear=2024&areaCode=E92000001&conversion=x",
		),
		measureId: "measure.example",
	});
	assert.equal(conversion.status, 422);

	const invalidCountry = parseAggregateQuery({
		parsedUrl: url(
			"period=2024&geography=localAuthority&boundaryYear=2024&areaCode=E1",
		),
		measureId: "measure.example",
	});
	assert.equal(invalidCountry.status, 400);

	const missingSource = parseAggregateQuery({
		parsedUrl: url("areaCode=E92000001"),
		measureId: "measure.example",
	});
	assert.equal(missingSource.status, 400);
});
