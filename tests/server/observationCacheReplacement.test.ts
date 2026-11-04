import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ObservationCache,
	type DataCatalog,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	closeAllReadOnlyDatabases,
	configureReadOnlyDatabases,
	type StatisticsReadPath,
} from "@uk-data-atlas/atlas-runtime/storage";

let directory: string;
let path: string;

/** A statistics database holding one measure, with Labour's vote in one ward. */
const writeDatabase = (target: string, votes: number) => {
	const database = new DatabaseSync(target);
	database.exec(`
		CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE area_releases (position INTEGER, geography TEXT, id TEXT);
		CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER);
		CREATE TABLE dimension (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE dimension_member (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
		CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
		CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT);
		CREATE TABLE status (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, lower REAL, upper REAL, status_id INTEGER);
		INSERT INTO dataset VALUES (1, 'local-election');
		INSERT INTO measure VALUES (1, 'party-votes');
		INSERT INTO area_releases VALUES (0, 'ward', '2019-12-uk-bgc');
		INSERT INTO dimension VALUES (1, 'party');
		INSERT INTO dimension_member VALUES (1, 'lab');
		INSERT INTO series VALUES (1, 1, 1, 0);
		INSERT INTO series_member VALUES (1, 1, 1);
		INSERT INTO area VALUES (1, 'E05000001');
		INSERT INTO area_version VALUES (1, 1, 0);
		INSERT INTO period VALUES (1, '2019-05-02');
		INSERT INTO status VALUES (1, 'observed');
		INSERT INTO observation VALUES (1, 1, 1, ${votes}, NULL, NULL, 1);
	`);
	database.close();
};

const replace = (votes: number) => {
	writeDatabase(`${path}.tmp`, votes);
	renameSync(`${path}.tmp`, path);
};

const catalog = {
	contentHash: "catalogue",
	measures: [
		{
			id: "lab-votes",
			sources: [
				{
					sourceGeography: { type: "ward", boundaryYear: 2019 },
					periods: ["2019"],
					observationArtifact: "lab-votes-observations",
				},
			],
		},
	],
} as unknown as DataCatalog;

const readPath = {
	schemaVersion: 1,
	dataCatalogHash: "catalogue",
	observations: {},
	statistics: {
		"lab-votes-observations": {
			datasetId: "local-election",
			measure: "party-votes",
			dimensions: { party: "lab" },
			geography: "ward",
		},
	},
} as unknown as StatisticsReadPath;

const votes = (cache: ObservationCache) =>
	(
		JSON.parse(cache.text(path, "lab-votes-observations")) as {
			periods: Array<{ records: Array<{ value: number }> }>;
		}
	).periods[0]!.records[0]!.value;

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), "observation-cache-"));
	path = join(directory, "atlas.sqlite");
	writeDatabase(path, 300);
	configureReadOnlyDatabases({ recheckMs: 0 });
});

afterEach(() => {
	closeAllReadOnlyDatabases();
	configureReadOnlyDatabases({ recheckMs: 1000 });
	rmSync(directory, { recursive: true, force: true });
});

describe("observation cache and a replaced database", () => {
	it("serves a repeat read from the cache", () => {
		const cache = new ObservationCache();
		cache.bindCatalogue(path, catalog, readPath);
		expect(votes(cache)).toBe(300);
		const first = cache.text(path, "lab-votes-observations");
		expect(cache.text(path, "lab-votes-observations")).toBe(first);
	});

	it("reads the new database after a replacement, not the cached text", () => {
		const cache = new ObservationCache();
		cache.bindCatalogue(path, catalog, readPath);
		expect(votes(cache)).toBe(300);
		replace(450);
		expect(votes(cache)).toBe(450);
	});
});
