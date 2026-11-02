import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import Papa from "papaparse";
import {
	exportStatisticsMeasure,
	expandStatisticsSelection,
	hashStatisticsSelection,
} from "../../../pipeline/src/statisticsExport";
import { readParquet } from "./parquetFixtures";
import { bindStatisticsField } from "../../../pipeline/src/bindStatisticsField";
import { bindCensusStatistics } from "../../../pipeline/src/bindCensusStatistics";
import { compileMeasureDownloads } from "../../../pipeline/src/measureDownloads";
import { gunzipSync } from "node:zlib";
import { measureStatisticsSelections } from "../../../pipeline/src/measureStatisticsSelections";
import type { Measure } from "@uk-data-atlas/atlas-runtime/catalogue";

test("binds a census measure only when every source partition is complete", () => {
	const db = new DatabaseSync(":memory:");
	try {
		db.exec(`
			CREATE TABLE dataset (id INTEGER, slug TEXT);
			CREATE TABLE measure (id INTEGER, slug TEXT);
			CREATE TABLE series (id INTEGER, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER);
			CREATE TABLE area_releases (position INTEGER, geography TEXT, id TEXT);
			CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
			CREATE TABLE dimension (id INTEGER, slug TEXT);
			CREATE TABLE dimension_member (id INTEGER, code TEXT);
			CREATE TABLE observation (series_id INTEGER, period_id INTEGER);
			CREATE TABLE period (id INTEGER, label TEXT);
			INSERT INTO dataset VALUES (1, 'census-2021-ts007a');
			INSERT INTO measure VALUES (1, 'census-2021-ts007a-count');
			INSERT INTO series VALUES (1, 1, 1, 1), (2, 1, 1, 2);
			INSERT INTO area_releases VALUES (1, 'lsoa', 'lsoa-2021'), (2, 'msoa', 'msoa-2021');
			INSERT INTO dimension VALUES (1, 'census-2021-ts007a-category');
			INSERT INTO dimension_member VALUES (1, '0-to-4');
			INSERT INTO series_member VALUES (1, 1, 1), (2, 1, 1);
			INSERT INTO period VALUES (1, '2021');
			INSERT INTO observation VALUES (1, 1), (2, 1);
		`);
		const measure = {
			id: "age-0-to-4",
			unit: "usual residents",
			sources: [
				{
					sourceGeography: { type: "lsoa", boundaryYear: 2021 },
					periods: ["2021"],
					coverage: { recordCount: 1 },
				},
				{
					sourceGeography: { type: "msoa", boundaryYear: 2021 },
					periods: ["2021"],
					coverage: { recordCount: 1 },
				},
			],
		} as unknown as Measure;
		assert.equal(bindCensusStatistics(db, measure)?.length, 2);
		measure.sources[1]!.coverage.recordCount = 2;
		assert.equal(bindCensusStatistics(db, measure), undefined);
	} finally {
		db.close();
	}
});

test("exports identical sorted canonical rows in CSV and Parquet", async () => {
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
			CREATE TABLE dataset_part (dataset_id INTEGER, position INTEGER, key TEXT);
			CREATE TABLE dataset_leaf (dataset_id INTEGER, part INTEGER, records TEXT, path TEXT, kind TEXT, series_id INTEGER, period_id INTEGER);
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
			INSERT INTO dataset_part VALUES (1, 0, '2021');
			INSERT INTO dataset_leaf VALUES (1, 0, 'data', '["rented"]', 'value', 1, 1), (1, 0, 'data', '["owned"]', 'value', 2, 1);
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
		assert.equal(
			exportStatisticsMeasure(db, "rented-homes", paths, [
				{
					dataset: "census",
					path: ["rented"],
					geography: "ward",
					release: "2021",
					periods: ["2021"],
				},
			]),
			1,
		);
		const selected = Papa.parse<Record<string, unknown>>(
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
		assert.deepEqual(selected.errors, []);
		assert.deepEqual(
			selected.data,
			readParquet(readFileSync(paths.parquet)).rows,
		);
		assert.equal(selected.data[0]?.dimension_tenure, "rented");
		assert.equal(selected.data[0]?.measure, "rented-homes");
		assert.deepEqual(
			hashStatisticsSelection(db, [
				{
					dataset: "census",
					path: ["rented"],
					geography: "ward",
					release: "2021",
					periods: ["2021"],
				},
			]),
			{
				recordCount: 1,
				recordHash:
					"7f04a3fba5d12c0f87f083ad56ec21c97ee75877ef5e83d9a8e4eb2888ea7e2b",
			},
		);
		const field = {
			dataset: "census",
			field: "rented",
			records: "data",
			sourcePeriod: "2021",
			publishedPeriod: "2021",
			geography: "ward",
			boundaryYear: 2021,
			recordCount: 1,
			recordHash:
				"7f04a3fba5d12c0f87f083ad56ec21c97ee75877ef5e83d9a8e4eb2888ea7e2b",
		};
		assert.deepEqual(bindStatisticsField(db, field, "households"), [
			{
				dataset: "census",
				path: ["rented"],
				geography: "ward",
				release: "2021",
				periods: ["2021"],
			},
		]);
		const catalogueMeasure = {
			id: "rented-homes",
			unit: "households",
			sources: [
				{
					datasetId: "census",
					sourceGeography: { type: "ward", boundaryYear: 2021 },
					periods: ["2021"],
				},
			],
		} as unknown as Measure;
		const bindings = [{ measureId: "rented-homes", field }];
		assert.equal(
			measureStatisticsSelections(db, catalogueMeasure, bindings)?.length,
			1,
		);
		catalogueMeasure.sources[0]!.periods.push("2022");
		assert.equal(
			measureStatisticsSelections(db, catalogueMeasure, bindings),
			undefined,
		);
		assert.equal(
			bindStatisticsField(db, { ...field, recordCount: 2 }, "households"),
			undefined,
		);
		assert.equal(bindStatisticsField(db, field, "people"), undefined);
		db.exec("UPDATE measure SET unit = 'percent of premises'");
		assert.ok(bindStatisticsField(db, field, "% of premises"));
		db.exec("UPDATE measure SET unit = 'households'");
		assert.deepEqual(
			bindStatisticsField(
				db,
				{ ...field, records: "partnerships" },
				"households",
				{
					type: "census",
					measures: [],
					fields: [{ path: "{tenure}", measure: "households" }],
					dimensions: [
						{
							slug: "tenure",
							label: "Tenure",
							members: [{ key: "rented", code: "rented" }],
						},
					],
				},
			),
			[
				{
					dataset: "census",
					measure: "households",
					members: { tenure: "rented" },
					geography: "ward",
					release: "2021",
					periods: ["2021"],
				},
			],
		);
		db.exec(`INSERT INTO dimension VALUES (2, 'place');
			INSERT INTO dimension_member VALUES (3, 'residence');
			INSERT INTO series_member VALUES (1, 2, 3)`);
		const config = {
			type: "census",
			measures: [],
			fields: [
				{
					path: "{tenure}",
					measure: "households",
					members: { place: "residence" },
				},
			],
			dimensions: [
				{
					slug: "tenure",
					label: "Tenure",
					members: [{ key: "rented", code: "rented" }],
				},
				{
					slug: "place",
					label: "Place",
					members: [
						{ key: "residence", code: "residence" },
						{ key: "workplace", code: "workplace" },
					],
				},
			],
		};
		assert.deepEqual(
			bindStatisticsField(
				db,
				{ ...field, records: "partnerships" },
				"households",
				config,
			),
			[
				{
					dataset: "census",
					measure: "households",
					members: { place: "residence", tenure: "rented" },
					geography: "ward",
					release: "2021",
					periods: ["2021"],
				},
			],
		);
		config.fields[0]!.members.place = "workplace";
		assert.equal(
			bindStatisticsField(
				db,
				{ ...field, records: "partnerships" },
				"households",
				config,
			),
			undefined,
		);
		assert.equal(
			exportStatisticsMeasure(db, "rented-homes", paths, [
				{
					dataset: "census",
					measure: "households",
					dimension: "tenure",
					member: "rented",
					geography: "ward",
					release: "2021",
					periods: ["2021"],
				},
				{
					dataset: "census",
					path: ["rented"],
					geography: "ward",
					release: "2021",
					periods: ["2021"],
				},
			]),
			1,
		);
		assert.equal(
			exportStatisticsMeasure(db, "rented-homes", paths, [
				{
					dataset: "census",
					path: ["rented"],
					geography: "ward",
					release: "2021",
					periods: ["2020"],
				},
			]),
			0,
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
		const chosen = [
			{
				dataset: "census",
				path: ["rented"],
				geography: "ward",
				release: "2021",
				periods: ["2021"],
			},
		];
		const downloads = await compileMeasureDownloads(
			db,
			directory,
			"rented-homes",
			chosen,
		);
		const csvDownload = downloads.find((item) => item.format === "csv")!;
		const parquetDownload = downloads.find(
			(item) => item.format === "parquet",
		)!;
		const csvBytes = gunzipSync(
			readFileSync(join(directory, csvDownload.artifact)),
		);
		const csvRows = Papa.parse<Record<string, unknown>>(
			csvBytes.toString("utf8"),
			{
				header: true,
				dynamicTyping: (field) =>
					typeof field === "string" &&
					["value", "lower", "upper"].includes(field),
				skipEmptyLines: true,
				transform: (value) => (value === "" ? null : value),
			},
		);
		assert.deepEqual(csvRows.errors, []);
		assert.deepEqual(
			csvRows.data,
			readParquet(readFileSync(join(directory, parquetDownload.artifact)))
				.rows,
		);
		const firstGzip = readFileSync(join(directory, csvDownload.artifact));
		assert.deepEqual(
			await compileMeasureDownloads(
				db,
				directory,
				"rented-homes",
				chosen,
			),
			downloads,
		);
		assert.deepEqual(
			readFileSync(join(directory, csvDownload.artifact)),
			firstGzip,
		);
		db.exec(`
			INSERT INTO area_releases VALUES (2, 'ward', '2022');
			INSERT INTO period VALUES (2, '2022');
			INSERT INTO series VALUES (3, 1, 1, 2, 'rented-2022');
			INSERT INTO series_member VALUES (3, 1, 1), (3, 2, 3);
			INSERT INTO observation VALUES (3, 1, 2, 11, NULL, NULL, NULL, 1);
		`);
		const expanded = expandStatisticsSelection(db, chosen);
		assert.equal(
			exportStatisticsMeasure(db, "rented-homes", paths, expanded),
			2052,
		);
		const expandedCsv = Papa.parse<Record<string, string>>(
			readFileSync(paths.csv, "utf8"),
			{ header: true, skipEmptyLines: true },
		);
		assert.ok(
			expandedCsv.data.some(
				(row) => row.release === "2022" && row.period === "2022",
			),
		);
	} finally {
		db.close();
		rmSync(directory, { recursive: true, force: true });
	}
});
