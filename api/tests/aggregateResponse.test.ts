import assert from "node:assert/strict";
import test from "node:test";
import type { AggregationTarget } from "../src/aggregationTarget";
import type { Measure, MeasureSource } from "../src/dataCatalog";
import { buildAggregateResponse } from "../src/aggregateResponse";

const measure = {
	id: "measure.example",
	label: "Example measure",
	valueKind: "quantity",
	unit: "units",
	aggregation: { kind: "extensive", operation: "sum", available: true },
	sources: [],
	availability: { sourceExact: true, conversion: false, aggregation: true },
	links: { data: "/v1/data/measure.example" },
} as Measure;

const source = {
	datasetId: "dataset.example",
	periods: ["2024"],
	sourceGeography: { type: "localAuthority", boundaryYear: 2024 },
	coverage: {
		kind: "source-reported",
		countries: [],
		recordCount: 2,
		note: "",
	},
} as MeasureSource;

const observations = {
	artifact: "observations/measure.example",
	contentHash: "sha256:observations",
};

const responseData = (response: ReturnType<typeof buildAggregateResponse>) =>
	(response.body as { data: Record<string, any> }).data;

test("builds country response metadata", () => {
	const data = responseData(
		buildAggregateResponse({
			releaseId: "atlas-2024",
			measure,
			measureId: measure.id,
			source,
			period: "2024",
			observations,
			aggregateValue: 30,
			aggregate: {
				members: [
					{ areaCode: "E1", value: 10, status: "observed" },
					{ areaCode: "E2", value: 20, status: "observed" },
				],
				value: 30,
			},
			areaCode: "E92000001",
		}),
	);
	assert.equal(data.record.value, 30);
	assert.equal(data.aggregation.membership, "gss-country-code");
	assert.equal(data.aggregation.operation, "sum");
	assert.equal(
		data.provenance.source.observations.contentHash,
		"sha256:observations",
	);
});

test("builds regional target and weighting metadata", () => {
	const regional = {
		claim: "published-membership-lookup",
		sourceRelease: "2024-01",
		memberCodes: new Set(["E1", "E2"]),
		target: {
			id: "region/2024-01/R1",
			geography: "region",
			boundaryRelease: "2024-01",
			code: "R1",
		},
		crosswalk: {
			id: "crosswalk.example",
			method: "official-lookup",
			quality: "official",
		},
	} as AggregationTarget;
	const data = responseData(
		buildAggregateResponse({
			releaseId: "atlas-2024",
			measure,
			measureId: measure.id,
			source,
			period: "2024",
			observations,
			aggregateValue: 15,
			aggregate: { members: [], value: 15 },
			regional,
			weightDescription: "Population denominator",
			weighting: {
				measure,
				source,
				observations: {
					artifact: "weights",
					contentHash: "sha256:weights",
				},
				total: 100,
			},
			coverage: { status: "complete", assessments: [] },
			areaCode: null,
		}),
	);
	assert.equal(data.target.id, "region/2024-01/R1");
	assert.equal(data.region.code, "R1");
	assert.equal(data.aggregation.operation, "weighted-mean");
	assert.equal(data.aggregation.crosswalk.id, "crosswalk.example");
	assert.deepEqual(data.aggregation.weight, {
		description: "Population denominator",
		total: 100,
	});
});

test("builds named-location membership metadata", () => {
	const data = responseData(
		buildAggregateResponse({
			releaseId: "atlas-2024",
			measure,
			measureId: measure.id,
			source,
			period: "2024",
			observations,
			aggregateValue: 10,
			aggregate: { members: [], value: 10 },
			location: {
				id: "example-location",
				label: "Example location",
				kind: "editorial-grouping",
				definitionRevision: 1,
				memberGeography: "localAuthority",
				memberCodes: ["E1"],
				validity: { from: null, to: null },
				bbox: [0, 0, 1, 1],
			},
			areaCode: null,
		}),
	);
	assert.equal(data.location.id, "example-location");
	assert.equal(data.aggregation.membership, "direct-code-match");
	assert.equal(data.aggregation.operation, "sum");
});
