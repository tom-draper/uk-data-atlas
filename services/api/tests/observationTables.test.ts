import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	observationTableOf,
	readSourceObservations,
	tableMeasureObservations,
	type MeasureTableArtifact,
} from "../src/observationTables";

const table: MeasureTableArtifact = {
	schemaVersion: 1,
	kind: "measure-table",
	contentHash: "sha256:table",
	id: "fixture-table",
	datasetId: "fixture",
	sourceGeography: { type: "lsoa", boundaryYear: 2021 },
	period: "2021",
	measures: ["owned", "rented"],
	records: [
		["E01000001", 10, 5],
		["E01000002", 7, null],
	],
};

test("serves one measure's column as an ordinary observation artifact", () => {
	const rented = tableMeasureObservations(table, "rented");

	assert.equal(rented.measureId, "rented");
	assert.equal(rented.contentHash, "sha256:table");
	assert.deepEqual(rented.sourceGeography, table.sourceGeography);
	// An unpublished value is left out rather than served as zero.
	assert.deepEqual(rented.periods[0]?.records, [
		{ areaCode: "E01000001", value: 5, status: "observed" },
	]);
	// A download of the view is the whole table it came from.
	assert.equal(observationTableOf(rented), table);
	assert.throws(
		() => tableMeasureObservations(table, "unknown"),
		/does not serve unknown/,
	);
});

test("builds a view's records only when first read", () => {
	let reads = 0;
	const counted = {
		...table,
		get records() {
			reads += 1;
			return table.records;
		},
	} as MeasureTableArtifact;
	const view = tableMeasureObservations(counted, "owned");

	assert.equal(reads, 0);
	assert.equal(view.periods[0]?.records.length, 2);
	assert.equal(view.periods[0]?.records.length, 2);
	assert.equal(reads, 1);
});

test("reads a shared table once and a measure's own artifact as it is", () => {
	const directory = mkdtempSync(join(tmpdir(), "observation-tables-"));
	try {
		writeFileSync(
			join(directory, "fixture-table.json"),
			JSON.stringify(table),
		);
		const own = {
			schemaVersion: 1,
			contentHash: "sha256:own",
			measureId: "population",
			sourceGeography: { type: "ward", boundaryYear: 2023 },
			periods: [{ period: "2022", records: [] }],
		};
		writeFileSync(
			join(directory, "population-observations.json"),
			JSON.stringify(own),
		);
		const tables = new Map<string, MeasureTableArtifact>();

		const owned = readSourceObservations(
			directory,
			"fixture-table",
			"owned",
			tables,
		);
		assert.equal(tables.size, 1);
		// The second measure comes from the cached table, not the file.
		rmSync(join(directory, "fixture-table.json"));
		const rented = readSourceObservations(
			directory,
			"fixture-table",
			"rented",
			tables,
		);
		assert.deepEqual(
			[
				owned.measureId,
				rented.measureId,
				rented.periods[0]?.records.length,
			],
			["owned", "rented", 1],
		);
		assert.deepEqual(
			readSourceObservations(
				directory,
				"population-observations",
				"population",
				tables,
			),
			own,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
