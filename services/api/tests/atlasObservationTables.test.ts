import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { replaceObservationTables } from "../src/atlasObservationTables";
import { rebuildObservationText } from "../src/atlasObservations";

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
