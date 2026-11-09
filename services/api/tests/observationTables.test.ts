import assert from "node:assert/strict";
import { test } from "vitest";
import {
	periodRecordLookup,
	type MeasureTableArtifact,
} from "@uk-data-atlas/catalogue/node";
import {
	observationTableOf,
	tableMeasureObservations,
} from "@uk-data-atlas/measures";

const table: MeasureTableArtifact = {
	schemaVersion: 1,
	kind: "measure-table",
	id: "fixture-table",
	datasetId: "fixture",
	sourceGeography: { type: "lsoa", boundaryYear: 2021 },
	period: "2021",
	measures: ["owned", "rented"],
	records: [
		["E1", 10, 5],
		["E2", 7, null],
	],
	contentHash: "sha256:table",
};

test("projects a shared table and preserves its provenance", () => {
	const view = tableMeasureObservations(table, "rented");
	assert.equal(view.measureId, "rented");
	assert.equal(view.contentHash, "sha256:table");
	assert.deepEqual(view.periods[0]?.records, [
		{ areaCode: "E1", value: 5, status: "observed" },
	]);
	assert.equal(observationTableOf(view), table);
	assert.throws(
		() => tableMeasureObservations(table, "missing"),
		/does not serve missing/,
	);
});

test("looks up a table value without materialising the records", () => {
	const view = tableMeasureObservations(table, "rented");
	const period = view.periods[0]!;
	const lookup = periodRecordLookup(period)!;
	assert.deepEqual(lookup("E1"), {
		areaCode: "E1",
		value: 5,
		status: "observed",
	});
	assert.equal(lookup("E2"), undefined);
	assert.equal(lookup("unknown"), undefined);
});

test("keeps zero values and ignores unpublished values", () => {
	const view = tableMeasureObservations(
		{
			...table,
			records: [
				["E1", 0, 0],
				["E2", 1, null],
				["E3", 2, -2],
			],
		},
		"rented",
	);
	assert.deepEqual(view.periods[0]?.records, [
		{ areaCode: "E1", value: 0, status: "observed" },
		{ areaCode: "E3", value: -2, status: "observed" },
	]);
});
