import assert from "node:assert/strict";
import test from "node:test";
import {
	observationArtifactName,
	type MeasureSource,
} from "../src/dataCatalog";
import { observationsFor } from "../src/observationArtifacts";
import {
	tableMeasureObservations,
	type MeasureTableArtifact,
} from "../src/observationTables";

const sourceGeography = { type: "lsoa", boundaryYear: 2021 } as const;
const source = {
	dataset: "fixture",
	sourceGeography,
	periods: ["2021"],
} as unknown as MeasureSource;

const table: MeasureTableArtifact = {
	schemaVersion: 1,
	kind: "measure-table",
	contentHash: "sha256:table",
	id: observationArtifactName("owned", source),
	datasetId: "fixture",
	sourceGeography,
	period: "2021",
	measures: ["owned"],
	records: [
		["E01000001", 10],
		["E01000002", null],
	],
};

test("finds one area's record in a measure's own artifact", () => {
	const observations = observationsFor("owned", source, "2021", {
		measureObservations: [
			{
				schemaVersion: 1,
				contentHash: "sha256:own",
				measureId: "owned",
				sourceGeography,
				periods: [
					{
						period: "2021",
						records: [
							{
								areaCode: "E01000001",
								value: 10,
								status: "derived",
							},
						],
					},
				],
			},
		],
	});

	assert.equal(observations?.recordFor("E01000001")?.status, "derived");
	assert.equal(observations?.recordFor("E01000002"), undefined);
	assert.equal(observations?.records.length, 1);
});

test("finds one area's record in a table's view, and none where unpublished", () => {
	const observations = observationsFor("owned", source, "2021", {
		measureObservations: [tableMeasureObservations(table, "owned")],
	});

	assert.deepEqual(observations?.recordFor("E01000001"), {
		areaCode: "E01000001",
		value: 10,
		status: "observed",
	});
	assert.equal(observations?.recordFor("E01000002"), undefined);
	assert.equal(observations?.contentHash, "sha256:table");
});

test("is undefined for a period the artifact does not hold", () => {
	assert.equal(
		observationsFor("owned", source, "1999", {
			measureObservations: [tableMeasureObservations(table, "owned")],
		}),
		undefined,
	);
});
