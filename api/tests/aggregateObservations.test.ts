import assert from "node:assert/strict";
import test from "node:test";
import type {
	AnyMeasureObservationArtifact,
	MeasureSource,
} from "../src/dataCatalog";
import { readAggregateObservations } from "../src/aggregateObservations";

const source = {
	datasetId: "dataset.example",
	periods: ["2024"],
	sourceGeography: { type: "localAuthority", boundaryYear: 2024 },
	coverage: {
		kind: "source-reported",
		countries: [],
		recordCount: 1,
		note: "",
	},
} as MeasureSource;

const artifact = (records: Array<Record<string, unknown>>) =>
	({
		schemaVersion: 1,
		contentHash: "sha256:observations",
		measureId: "measure.example",
		sourceGeography: source.sourceGeography,
		periods: [{ period: "2024", records }],
	}) as AnyMeasureObservationArtifact;

test("reads numeric source-exact records", () => {
	const result = readAggregateObservations({
		measureId: "measure.example",
		source,
		period: "2024",
		artifacts: {
			measureObservations: [artifact([{ areaCode: "E1", value: 4 }])],
		},
	});
	assert.equal("status" in result, false);
	if ("status" in result) return;
	assert.equal(result.observations.contentHash, "sha256:observations");
	assert.deepEqual(result.records, [{ areaCode: "E1", value: 4 }]);
});

test("reports missing and non-numeric catalogue artifacts", () => {
	const missing = readAggregateObservations({
		measureId: "measure.example",
		source,
		period: "2024",
		artifacts: {},
	});
	assert.equal("status" in missing ? missing.status : undefined, 503);

	const nonNumeric = readAggregateObservations({
		measureId: "measure.example",
		source,
		period: "2024",
		artifacts: {
			measureObservations: [
				artifact([{ areaCode: "E1", category: "high" }]),
			],
		},
	});
	assert.equal("status" in nonNumeric ? nonNumeric.status : undefined, 503);
});
