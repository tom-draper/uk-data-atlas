import assert from "node:assert/strict";
import test from "node:test";
import { calculateWeightedAggregate } from "../src/weightedAggregation";

const records = [
	{ areaCode: "E1", value: 10 },
	{ areaCode: "E2", value: 20 },
];

test("calculates a country weighted aggregate", () => {
	assert.deepEqual(
		calculateWeightedAggregate({
			aggregate: { members: records, value: 30 },
			weightRecords: [
				{ areaCode: "E1", value: 1 },
				{ areaCode: "E2", value: 3 },
			],
			areaCode: "E92000001",
		}),
		{ kind: "ok", value: 17.5, totalWeight: 4 },
	);
});

test("uses only named-location members", () => {
	assert.deepEqual(
		calculateWeightedAggregate({
			aggregate: { members: [records[0]], value: 10 },
			weightRecords: [
				{ areaCode: "E1", value: 1 },
				{ areaCode: "E2", value: 3 },
			],
			location: {
				id: "example",
				label: "Example",
				kind: "editorial-grouping",
				definitionRevision: 1,
				memberGeography: "localAuthority",
				memberCodes: ["E1"],
				validity: { from: null, to: null },
				bbox: [0, 0, 1, 1],
			},
		}),
		{ kind: "ok", value: 10, totalWeight: 1 },
	);
});

test("reports partial coverage and invalid weights", () => {
	assert.equal(
		calculateWeightedAggregate({
			aggregate: { members: records, value: 30 },
			weightRecords: [records[0]],
			areaCode: "E92000001",
		}).status,
		422,
	);
	assert.equal(
		calculateWeightedAggregate({
			aggregate: { members: records, value: 30 },
			weightRecords: [
				{ areaCode: "E1", value: 0 },
				{ areaCode: "E2", value: 0 },
			],
			areaCode: "E92000001",
		}).status,
		422,
	);
});
