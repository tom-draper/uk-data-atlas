import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";
import { storeObservations } from "../../../pipeline/src/store-observations";
import {
	assertObservationCatalogue,
	readObservationInventory,
	readObservationText,
} from "../src/atlasObservations";
import { readMeasureObservations } from "../src/observationLoader";
import {
	readSourceObservations,
	observationTableOf,
	type MeasureTableArtifact,
} from "../src/observationTables";
import { compileExportManifest } from "../../../pipeline/src/exportManifest";
import { compileMeasureCompatibility } from "../../../pipeline/src/measureCompatibility";
import { route } from "../src/routes";
import { dataCatalog, measureObservations, testContext } from "./routeFixtures";
import type {
	DataCatalog,
	AnyMeasureObservationArtifact,
} from "../src/dataCatalog";
import { artifactRoot } from "../../../shared/dataLayout";

const originalMeasure = dataCatalog.measures.find(
	(measure) => measure.id === "small-area-fixture",
)!;
const numeric: AnyMeasureObservationArtifact = {
	...measureObservations.find(
		(artifact) => artifact.measureId === originalMeasure.id,
	)!,
	measureId: "numeric",
};
const table: MeasureTableArtifact = {
	schemaVersion: 1,
	kind: "measure-table",
	id: "shared-table",
	datasetId: "population",
	sourceGeography: numeric.sourceGeography,
	period: "2019",
	measures: ["owned", "rented"],
	records: [
		["E01000001", 0, 7],
		["E01000002", 12, null],
	],
	contentHash: "sha256:table",
};
const catalog: DataCatalog = {
	...dataCatalog,
	measures: ["numeric", "owned", "rented"].map((id) => ({
		...originalMeasure,
		id,
		sources: [
			{
				...originalMeasure.sources[0],
				datasetId: "population",
				...(id === "numeric" ? {} : { observationArtifact: table.id }),
			},
		],
	})),
};
const entries = (): Array<readonly [string, string]> => [
	["numeric-observations", `${JSON.stringify(numeric)}\n`],
	[table.id, `${JSON.stringify(table)}\n`],
];

function fixture(t: TestContext) {
	const root = mkdtempSync(join(tmpdir(), "atlas-observations-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	const publicDirectory = artifactRoot(apiRoot);
	mkdirSync(publicDirectory, { recursive: true });
	mkdirSync(join(root, "data/build"), { recursive: true });
	const path = join(root, "data/build/atlas.sqlite");
	const database = new DatabaseSync(path);
	database.exec(
		"CREATE TABLE retained (value TEXT); INSERT INTO retained VALUES ('unchanged')",
	);
	database.close();
	return { root, apiRoot, publicDirectory, path };
}

function mutate(path: string, sql: string) {
	const database = new DatabaseSync(path);
	try {
		database.exec(sql);
	} finally {
		database.close();
	}
}

test("publishes exact SQLite payloads once per source, preserves other tables, and removes JSON after success", (t) => {
	const { root, apiRoot, publicDirectory, path } = fixture(t);
	for (const name of [
		"numeric-observations.json",
		"shared-table.json.gz",
		"obsolete-observations.json.gz",
	])
		writeFileSync(join(publicDirectory, name), "obsolete");
	writeFileSync(join(publicDirectory, "data-catalog.json"), "retained");
	for (let run = 0; run < 2; run++)
		storeObservations(root, catalog, entries());
	assert.deepEqual([...readObservationInventory(path).names].sort(), [
		"numeric-observations",
		"shared-table",
	]);
	for (const [id, text] of entries())
		assert.equal(readObservationText(path, id), text);
	assert.deepEqual(readdirSync(publicDirectory), ["data-catalog.json"]);
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		assert.equal(
			database.prepare("SELECT value FROM retained").get()?.value,
			"unchanged",
		);
	} finally {
		database.close();
	}
	const [own, owned, rented] = readMeasureObservations(apiRoot, catalog);
	assert.deepEqual(JSON.parse(JSON.stringify(own)), numeric);
	assert.deepEqual(owned.periods[0].records, [
		{ areaCode: "E01000001", value: 0, status: "observed" },
		{ areaCode: "E01000002", value: 12, status: "observed" },
	]);
	assert.deepEqual(rented.periods[0].records, [
		{ areaCode: "E01000001", value: 7, status: "observed" },
	]);
	assert.equal(observationTableOf(owned), observationTableOf(rented));
});

test("compatibility and exports consume SQLite with unchanged hashes, bytes and table contracts", (t) => {
	const { root, apiRoot, publicDirectory, path } = fixture(t);
	storeObservations(root, catalog, entries());
	const views = readMeasureObservations(apiRoot, catalog);
	const eager = catalog.measures.map((measure) =>
		readSourceObservations(
			path,
			measure.id === "numeric" ? "numeric-observations" : table.id,
			measure.id,
		),
	);
	assert.deepEqual(
		compileMeasureCompatibility(
			catalog,
			testContext().boundaryRegistry,
			[],
			views,
		),
		compileMeasureCompatibility(
			catalog,
			testContext().boundaryRegistry,
			[],
			eager,
		),
	);
	const exports = compileExportManifest(publicDirectory, catalog, path);
	for (const entry of exports.exports) {
		const text = entries().find(([id]) => id === entry.artifact)![1];
		assert.equal(entry.bytes, Buffer.byteLength(text));
		const response = route(
			"GET",
			entry.href,
			testContext({
				dataCatalog: catalog,
				measureObservations: views,
				exportManifest: exports,
			}),
		);
		assert.equal(response.status, 200);
		assert.equal(response.representation?.body, text);
		assert.equal(
			entry.contentHash,
			entry.measureId === "numeric"
				? numeric.contentHash
				: table.contentHash,
		);
		for (const download of entry.formats ?? [])
			assert.ok(existsSync(join(publicDirectory, download.artifact)));
	}
});

test("failed publication retains the database and legacy JSON, and cleans temporary files", (t) => {
	const { root, publicDirectory, path } = fixture(t);
	storeObservations(root, catalog, entries());
	const before = readFileSync(path);
	const legacy = join(publicDirectory, "numeric-observations.json");
	writeFileSync(legacy, "retained until publication");
	for (const invalid of [
		entries().slice(0, 1),
		[...entries(), entries()[0]],
		[["numeric-observations", "invalid JSON"]] as const,
	]) {
		assert.throws(() => storeObservations(root, catalog, invalid));
		assert.deepEqual(readFileSync(path), before);
		assert.equal(
			readFileSync(legacy, "utf8"),
			"retained until publication",
		);
		assert.deepEqual(readdirSync(join(root, "data/build")), [
			"artifacts",
			"atlas.sqlite",
		]);
	}
});

test("rejects stale catalogues, missing SQLite rows and corrupted bytes without JSON fallback", (t) => {
	const { root, apiRoot, publicDirectory, path } = fixture(t);
	assert.throws(
		() => readMeasureObservations(apiRoot, catalog),
		/pnpm data:build --from data-catalog/,
	);
	storeObservations(root, catalog, entries());
	assert.throws(
		() =>
			readMeasureObservations(apiRoot, {
				...catalog,
				contentHash: "stale",
			}),
		/another data catalogue/,
	);
	writeFileSync(
		join(publicDirectory, "numeric-observations.json"),
		entries()[0][1],
	);
	mutate(
		path,
		"UPDATE observations SET value = value + 1 WHERE seriesId = (SELECT position FROM observation_series WHERE artifactId = 'numeric-observations')",
	);
	assert.throws(
		() => readMeasureObservations(apiRoot, catalog)[0].periods,
		/Corrupt SQLite measure observations/,
	);
	assert.throws(
		() => compileExportManifest(publicDirectory, catalog, path),
		/Corrupt SQLite measure observations/,
	);
	mutate(
		path,
		"PRAGMA foreign_keys = OFF; DELETE FROM observation_series WHERE artifactId = 'numeric-observations'",
	);
	assert.throws(
		() => assertObservationCatalogue(path, catalog),
		/Missing SQLite measure observations/,
	);
	assert.throws(
		() => readObservationText(path, "numeric-observations"),
		/Missing SQLite measure observations/,
	);
});

test("live lazy views reject a newly published generation after cache eviction", (t) => {
	const { root, apiRoot } = fixture(t);
	storeObservations(root, catalog, entries());
	const views = readMeasureObservations(apiRoot, catalog, 0);
	assert.equal(views[0].periods[0].records[0].areaCode, "E01000001");
	const changed = entries();
	changed[0] = [
		changed[0][0],
		`${JSON.stringify({ ...numeric, contentHash: "changed", periods: [] })}\n`,
	];
	storeObservations(root, catalog, changed);
	assert.throws(() => views[0].periods, /changed while serving/);
	assert.deepEqual(readMeasureObservations(apiRoot, catalog)[0].periods, []);
});

test("JSON downloads return the stored bytes and refuse mismatched manifest bytes", (t) => {
	const { root, apiRoot, publicDirectory, path } = fixture(t);
	storeObservations(root, catalog, entries());
	const manifest = compileExportManifest(publicDirectory, catalog, path);
	const observations = readMeasureObservations(apiRoot, catalog);
	const context = testContext({
		dataCatalog: catalog,
		measureObservations: observations,
		exportManifest: manifest,
	});
	assert.equal(
		route("GET", "/v1/exports/numeric-observations", context).representation
			?.body,
		entries()[0][1],
	);
	manifest.exports.find((entry) => entry.id === "numeric-observations")!
		.bytes++;
	assert.equal(
		route("GET", "/v1/exports/numeric-observations", context).status,
		503,
	);
});

test("refuses artifacts whose bytes the rows could not rebuild", (t) => {
	const { root, path } = fixture(t);
	const before = readFileSync(path);
	const reordered = entries();
	reordered[0] = [
		reordered[0][0],
		`${JSON.stringify({ periods: numeric.periods, sourceGeography: numeric.sourceGeography, measureId: numeric.measureId, contentHash: numeric.contentHash, schemaVersion: numeric.schemaVersion })}\n`,
	];
	assert.throws(() => storeObservations(root, catalog, reordered));
	assert.deepEqual(readFileSync(path), before);
});

test("republishing a smaller catalogue removes obsolete SQLite artifacts", (t) => {
	const { root, path } = fixture(t);
	storeObservations(root, catalog, entries());
	const smaller = { ...catalog, measures: [catalog.measures[0]] };
	storeObservations(root, smaller, entries().slice(0, 1));
	assert.deepEqual(
		[...readObservationInventory(path).names],
		["numeric-observations"],
	);
	assert.throws(
		() => readObservationText(path, table.id),
		/Missing SQLite measure observations/,
	);
});
