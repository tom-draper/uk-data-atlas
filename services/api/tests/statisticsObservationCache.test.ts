import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import {
	readMeasureObservations,
	type DataCatalog,
	type StatisticsReadPath,
} from "@uk-data-atlas/atlas-runtime/catalogue";

test("reads catalogue observations from statistics without legacy tables", (context) => {
	const root = mkdtempSync(join(tmpdir(), "statistics-observation-cache-"));
	context.onTestFinished(() =>
		rmSync(root, { recursive: true, force: true }),
	);
	mkdirSync(join(root, "data/build"), { recursive: true });
	const database = new DatabaseSync(join(root, "data/build/atlas.sqlite"));
	database.exec(`
		CREATE TABLE dataset (id INTEGER, slug TEXT);
		CREATE TABLE measure (id INTEGER, slug TEXT);
		CREATE TABLE series (id INTEGER, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER);
		CREATE TABLE area_releases (id INTEGER, geography TEXT, release TEXT);
		CREATE TABLE dimension (id INTEGER, slug TEXT);
		CREATE TABLE dimension_member (id INTEGER, code TEXT);
		CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
		CREATE TABLE area (id INTEGER, code TEXT);
		CREATE TABLE area_version (id INTEGER, area_id INTEGER);
		CREATE TABLE period (id INTEGER, label TEXT);
		CREATE TABLE status (id INTEGER, slug TEXT);
		CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, lower REAL, upper REAL, status_id INTEGER);
		INSERT INTO dataset VALUES (1, 'fixture');
		INSERT INTO measure VALUES (1, 'count');
		INSERT INTO area_releases VALUES (1, 'ward', '2024');
		INSERT INTO series VALUES (1, 1, 1, 1);
		INSERT INTO area VALUES (1, 'E1');
		INSERT INTO area_version VALUES (1, 1);
		INSERT INTO period VALUES (1, '2024');
		INSERT INTO status VALUES (1, 'observed');
		INSERT INTO observation VALUES (1, 1, 1, 42, NULL, NULL, 1);
	`);
	database.close();
	const catalog = {
		contentHash: "fixture-hash",
		measures: [
			{
				id: "count",
				sources: [
					{
						datasetId: "fixture",
						periods: ["2024"],
						sourceGeography: { type: "ward", boundaryYear: 2024 },
					},
				],
			},
		],
	} as unknown as DataCatalog;
	const readPath: StatisticsReadPath = {
		schemaVersion: 1,
		dataCatalogHash: "fixture-hash",
		statistics: {
			"count-observations": {
				datasetId: "fixture",
				measure: "count",
				dimensions: {},
				geography: "ward",
			},
		},
		observations: {},
	};
	const [view] = readMeasureObservations(root, catalog, 0, readPath);
	assert.deepEqual(view?.periods[0]?.records, [
		{ areaCode: "E1", value: 42, status: "observed" },
	]);
	const [cached] = readMeasureObservations(root, catalog, 4096, readPath);
	assert.deepEqual(cached?.periods[0]?.records[0], {
		areaCode: "E1",
		value: 42,
		status: "observed",
	});
	const update = new DatabaseSync(join(root, "data/build/atlas.sqlite"));
	update.exec("UPDATE observation SET value = 43");
	update.close();
	// A rewritten database drops what the cache read from it.
	assert.deepEqual(cached?.periods[0]?.records[0], {
		areaCode: "E1",
		value: 43,
		status: "observed",
	});
	assert.deepEqual(view?.periods[0]?.records[0], {
		areaCode: "E1",
		value: 43,
		status: "observed",
	});
	assert.throws(
		() =>
			readMeasureObservations(root, catalog, 0, {
				...readPath,
				observations: { extra: "missing" },
			}),
		/unsupported observation artifacts/,
	);
});
