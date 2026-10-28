import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { dataCatalog } from "./routeFixtures";
import { replaceObservationTables } from "../../../pipeline/src/atlasObservationTables";
import { rebuildObservationText } from "@uk-data-atlas/atlas-runtime/storage";

const geography = { type: "ward", boundaryYear: 2024 };
const own = {
	schemaVersion: 1,
	contentHash: "sha256:own",
	measureId: "population",
	sourceGeography: geography,
	periods: [
		{
			period: "2023",
			records: [
				{
					areaCode: "E05000001",
					sourceAreaCode: "OLD",
					value: 1.5,
					status: "derived",
					confidenceInterval: { lower: 0, upper: 2 },
				},
				{
					areaCode: "E05000002",
					category: "Green",
					status: "observed",
				},
			],
		},
		{
			period: "2024",
			records: [{ areaCode: "E05000001", value: 0, status: "observed" }],
		},
	],
};
const table = {
	schemaVersion: 1,
	kind: "measure-table",
	id: "shared",
	datasetId: "fixture",
	sourceGeography: geography,
	period: "2021",
	measures: ["owned", "rented"],
	records: [
		["E05000001", 10, 5],
		["E05000002", 0, null],
	],
	contentHash: "sha256:table",
};
const text = (artifact: object) => `${JSON.stringify(artifact)}\n`;

function store(entries: Array<readonly [string, string]>) {
	const database = new DatabaseSync(":memory:");
	replaceObservationTables(database, entries);
	return database;
}

test("rebuilds the stored bytes of measure and shared table artifacts", () => {
	const entries = [
		["own-observations", text(own)],
		["shared", text(table)],
	] as const;
	const database = store([...entries]);
	for (const [id, original] of entries)
		assert.equal(rebuildObservationText(database, id)?.text, original);
	assert.equal(rebuildObservationText(database, "absent"), undefined);
});

test("decoded views read as the artifact's own values", () => {
	const database = store([
		["own-observations", text(own)],
		["shared", text(table)],
	]);
	assert.deepEqual(
		database
			.prepare(
				"SELECT period, areaCode, sourceAreaCode, value, category, status, confidenceLower, confidenceUpper FROM observations_decoded WHERE artifactId = 'own-observations' ORDER BY period, areaCode",
			)
			.all()
			.map((row) => ({ ...row })),
		[
			{
				period: "2023",
				areaCode: "E05000001",
				sourceAreaCode: "OLD",
				value: 1.5,
				category: null,
				status: "derived",
				confidenceLower: 0,
				confidenceUpper: 2,
			},
			{
				period: "2023",
				areaCode: "E05000002",
				sourceAreaCode: null,
				value: null,
				category: "Green",
				status: "observed",
				confidenceLower: null,
				confidenceUpper: null,
			},
			{
				period: "2024",
				areaCode: "E05000001",
				sourceAreaCode: null,
				value: 0,
				category: null,
				status: "observed",
				confidenceLower: null,
				confidenceUpper: null,
			},
		],
	);
	assert.deepEqual(
		database
			.prepare(
				"SELECT areaCode, owned, rented FROM observation_shared_decoded ORDER BY position",
			)
			.all()
			.map((row) => ({ ...row })),
		[
			{ areaCode: "E05000001", owned: 10, rented: 5 },
			{ areaCode: "E05000002", owned: 0, rented: null },
		],
	);
});

test("replacing the tables drops those of artifacts no longer stored", () => {
	const database = store([
		["own-observations", text(own)],
		["shared", text(table)],
	]);
	replaceObservationTables(database, [["own-observations", text(own)]]);
	assert.equal(rebuildObservationText(database, "shared"), undefined);
	assert.equal(
		database
			.prepare(
				"SELECT 1 FROM sqlite_master WHERE name = 'observation_shared'",
			)
			.get(),
		undefined,
	);
});

test("refuses artifacts whose bytes rows could not rebuild, and keeps the tables it had", () => {
	const database = store([["own-observations", text(own)]]);
	const [first] = own.periods;
	const records = (record: object) => ({
		...own,
		periods: [{ ...first, records: [record] }],
	});
	for (const [artifact, message] of [
		[
			records({
				areaCode: "E05000001",
				value: 1,
				status: "observed",
				rank: 4,
			}),
			/cannot be stored as a row/,
		],
		[
			records({ status: "observed", areaCode: "E05000001", value: 1 }),
			/cannot be stored as a row/,
		],
		[
			{ ...own, periods: [...own.periods].reverse() },
			/not in ascending order/,
		],
		[
			{ ...own, periods: [{ period: "2023", records: [] }] },
			/cannot be stored|empty|period/,
		],
		[{ unrelated: true }, /unknown shape/],
		[{ ...table, id: "other" }, /names itself/],
	] as const) {
		assert.throws(
			() => replaceObservationTables(database, [["x", text(artifact)]]),
			message,
		);
		assert.equal(
			rebuildObservationText(database, "own-observations")?.text,
			text(own),
		);
	}
});

test("describes catalogue measures and datasets while allowing unknown measures", () => {
	const database = new DatabaseSync(":memory:");
	const measure = dataCatalog.measures[0]!;
	const catalog = {
		...dataCatalog,
		measures: [
			{
				...measure,
				id: "population",
				sources: measure.sources.slice(0, 1).map((source) => ({
					...source,
					observationArtifact: "own-observations",
				})),
			},
		],
	};
	replaceObservationTables(
		database,
		[
			["own-observations", text(own)],
			["shared", text(table)],
		],
		catalog,
	);
	assert.deepEqual(
		{
			...database
				.prepare(
					"SELECT label, unit, valueKind, aggregationKind, aggregationAvailable FROM observation_measures WHERE measureId = 'population'",
				)
				.get(),
		},
		{
			label: measure.label,
			unit: measure.unit,
			valueKind: measure.valueKind,
			aggregationKind: measure.aggregation.kind,
			aggregationAvailable: Number(measure.aggregation.available),
		},
	);
	assert.equal(
		database
			.prepare(
				"SELECT label FROM observation_measures WHERE measureId = 'owned'",
			)
			.get()?.label,
		null,
	);
	assert.equal(
		database
			.prepare(
				"SELECT datasetId FROM observation_series WHERE artifactId = 'own-observations'",
			)
			.get()?.datasetId,
		measure.sources[0]!.datasetId,
	);
	assert.equal(
		database.prepare("SELECT count(*) AS n FROM observation_datasets").get()
			?.n,
		catalog.datasets.length,
	);
	database.close();
});

test("unifies census cells with ordinary observations, including zero and null cells", () => {
	const database = store([
		["own-observations", text(own)],
		["shared", text(table)],
	]);
	assert.deepEqual(
		database
			.prepare(
				"SELECT artifactId, measureId, period, areaCode, value, status, sourceAreaCode, category, confidenceLower, confidenceUpper FROM observations_all WHERE measureId = 'rented' ORDER BY areaCode",
			)
			.all()
			.map((row) => ({ ...row })),
		[5, null].map((value, index) => ({
			artifactId: "shared",
			measureId: "rented",
			period: "2021",
			areaCode: `E0500000${index + 1}`,
			value,
			status: null,
			sourceAreaCode: null,
			category: null,
			confidenceLower: null,
			confidenceUpper: null,
		})),
	);
	assert.equal(
		database
			.prepare(
				"SELECT value FROM observations_all WHERE measureId = 'owned' AND areaCode = 'E05000002'",
			)
			.get()?.value,
		0,
	);
	assert.equal(
		database.prepare("SELECT count(*) AS n FROM observations_all").get()?.n,
		7,
	);
	replaceObservationTables(database, [["own-observations", text(own)]]);
	assert.equal(
		database.prepare("SELECT count(*) AS n FROM observations_all").get()?.n,
		3,
	);
	database.close();
});

test("cleanup preserves unrelated observation objects and the catalogue", () => {
	const database = store([
		["own-observations", text(own)],
		["shared", text(table)],
	]);
	database.exec(
		"CREATE TABLE observation_custom (value TEXT); INSERT INTO observation_custom VALUES ('keep'); CREATE VIEW observation_custom_view AS SELECT * FROM observation_custom; CREATE TABLE observation_catalogue (generationHash TEXT); INSERT INTO observation_catalogue VALUES ('keep'); CREATE TABLE observation_census_unregistered (value TEXT)",
	);
	replaceObservationTables(database, [["own-observations", text(own)]]);
	assert.equal(
		database.prepare("SELECT value FROM observation_custom_view").get()
			?.value,
		"keep",
	);
	assert.equal(
		database
			.prepare("SELECT generationHash FROM observation_catalogue")
			.get()?.generationHash,
		"keep",
	);
	assert.ok(
		database
			.prepare(
				"SELECT 1 FROM sqlite_master WHERE name = 'observation_census_unregistered'",
			)
			.get(),
	);
	assert.equal(
		database
			.prepare(
				"SELECT 1 FROM sqlite_master WHERE name IN ('observation_shared', 'observation_shared_decoded')",
			)
			.get(),
		undefined,
	);
	database.close();
});
