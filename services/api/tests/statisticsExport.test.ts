import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import Papa from "papaparse";
import { exportStatisticsMeasure } from "../../../pipeline/src/statisticsExport";
import { readParquet } from "./parquetFixtures";

test("exports identical sorted canonical rows in CSV and Parquet", () => {
	const db = new DatabaseSync(":memory:");
	const directory = mkdtempSync(join(tmpdir(), "statistics-export-"));
	try {
		db.exec(`
			CREATE TABLE dataset (id INTEGER, slug TEXT);
			CREATE TABLE measure (id INTEGER, slug TEXT, unit TEXT);
			CREATE TABLE series (id INTEGER, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, key TEXT);
			CREATE TABLE dimension (id INTEGER, slug TEXT);
			CREATE TABLE dimension_member (id INTEGER, code TEXT);
			CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
			CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, lower REAL, upper REAL, category_id INTEGER, status_id INTEGER);
			CREATE TABLE area_releases (position INTEGER, geography TEXT, id TEXT);
			CREATE TABLE area_version (id INTEGER, area_id INTEGER);
			CREATE TABLE area (id INTEGER, code TEXT);
			CREATE TABLE period (id INTEGER, label TEXT);
			CREATE TABLE status (id INTEGER, slug TEXT);
			INSERT INTO dataset VALUES (1, 'census');
			INSERT INTO measure VALUES (1, 'households', 'households');
			INSERT INTO dimension VALUES (1, 'tenure');
			INSERT INTO dimension_member VALUES (1, 'rented'), (2, 'owned');
			INSERT INTO series VALUES (1, 1, 1, 1, 'rented'), (2, 1, 1, 1, 'owned');
			INSERT INTO series_member VALUES (1, 1, 1), (2, 1, 2);
			INSERT INTO area_releases VALUES (1, 'ward', '2021');
			INSERT INTO area VALUES (1, 'E01'), (2, 'E02');
			INSERT INTO area_version VALUES (1, 1), (2, 2);
			INSERT INTO period VALUES (1, '2021');
			INSERT INTO status VALUES (1, 'observed'), (2, 'suppressed');
			INSERT INTO observation VALUES (1, 2, 1, 10, 9, 11, NULL, 1), (2, 1, 1, NULL, NULL, NULL, NULL, 2);
		`);
		const paths = {
			csv: join(directory, "rows.csv"),
			parquet: join(directory, "rows.parquet"),
		};
		assert.equal(exportStatisticsMeasure(db, "households", paths), 2);
		const csv = Papa.parse<Record<string, unknown>>(
			readFileSync(paths.csv, "utf8"),
			{
				header: true,
				dynamicTyping: (field) =>
					typeof field === "string" &&
					["value", "lower", "upper"].includes(field),
				skipEmptyLines: true,
				transform: (value) => (value === "" ? null : value),
			},
		);
		assert.deepEqual(csv.errors, []);
		assert.deepEqual(
			csv.data,
			readParquet(readFileSync(paths.parquet)).rows,
		);
		assert.deepEqual(
			csv.data.map((row) => row.area_code),
			["E01", "E02"],
		);
		assert.deepEqual(
			csv.data.map((row) => row.dimension_tenure),
			["owned", "rented"],
		);
		const first = [readFileSync(paths.csv), readFileSync(paths.parquet)];
		exportStatisticsMeasure(db, "households", paths);
		assert.deepEqual(
			[readFileSync(paths.csv), readFileSync(paths.parquet)],
			first,
		);
		db.exec(`
			WITH RECURSIVE n(x) AS (VALUES (3) UNION ALL SELECT x + 1 FROM n WHERE x < 2052)
			INSERT INTO area SELECT x, printf('Z%05d', x) FROM n;
			WITH RECURSIVE n(x) AS (VALUES (3) UNION ALL SELECT x + 1 FROM n WHERE x < 2052)
			INSERT INTO area_version SELECT x, x FROM n;
			WITH RECURSIVE n(x) AS (VALUES (3) UNION ALL SELECT x + 1 FROM n WHERE x < 2052)
			INSERT INTO observation SELECT 1, x, 1, x, NULL, NULL, NULL, 1 FROM n;
		`);
		assert.equal(exportStatisticsMeasure(db, "households", paths), 2052);
		const largeCsv = Papa.parse<Record<string, unknown>>(
			readFileSync(paths.csv, "utf8"),
			{
				header: true,
				dynamicTyping: (field) =>
					typeof field === "string" &&
					["value", "lower", "upper"].includes(field),
				skipEmptyLines: true,
				transform: (value) => (value === "" ? null : value),
			},
		);
		assert.deepEqual(largeCsv.errors, []);
		assert.deepEqual(
			largeCsv.data,
			readParquet(readFileSync(paths.parquet)).rows,
		);
	} finally {
		db.close();
		rmSync(directory, { recursive: true, force: true });
	}
});
