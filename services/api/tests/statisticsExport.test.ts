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
import { bindReviewedStatistics } from "../../../pipeline/src/bindReviewedStatistics";
import { observationArtifactName } from "@uk-data-atlas/measures";
import type { StatisticsReadPath } from "@uk-data-atlas/atlas-runtime/storage";
import { bindCompiledFields } from "../../../pipeline/src/bindCompiledFields";
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
			INSERT INTO measure VALUES (1, 'usual-residents');
			INSERT INTO series VALUES (1, 1, 1, 1), (2, 1, 1, 2), (3, 1, 1, 1);
			INSERT INTO area_releases VALUES (1, 'lsoa', 'lsoa-2021'), (2, 'msoa', 'msoa-2021');
			INSERT INTO dimension VALUES (1, 'age-band');
			INSERT INTO dimension_member VALUES (1, '0-to-4');
			INSERT INTO series_member VALUES (1, 1, 1), (2, 1, 1);
			INSERT INTO period VALUES (1, '2021-census');
			INSERT INTO observation VALUES (1, 1), (2, 1), (3, 1), (3, 1);
		`);
		const measure = {
			id: "age-0-to-4",
			unit: "usual residents",
			sources: [
				{
					datasetId: "census-2021-ts007a",
					sourceGeography: { type: "lsoa", boundaryYear: 2021 },
					periods: ["2021"],
					coverage: { recordCount: 1 },
				},
				{
					datasetId: "census-2021-ts007a",
					sourceGeography: { type: "msoa", boundaryYear: 2021 },
					periods: ["2021"],
					coverage: { recordCount: 1 },
				},
			],
		} as unknown as Measure;
		const ids = {
			"age-0-to-4": {
				measure: "usual-residents",
				dimensions: { "age-band": "0-to-4" },
			},
		};
		const bound = bindCensusStatistics(db, measure, ids);
		assert.equal(bound?.length, 2);
		assert.deepEqual(bound?.[0], {
			dataset: "census-2021-ts007a",
			measure: "usual-residents",
			members: { "age-band": "0-to-4" },
			exact: true,
			geography: "lsoa",
			release: "lsoa-2021",
			periods: ["2021-census"],
		});
		assert.equal(bindCensusStatistics(db, measure, {}), undefined);
		measure.sources.push({
			...measure.sources[0]!,
			datasetId: "ethnicity",
		});
		assert.equal(bindCensusStatistics(db, measure, ids), undefined);
		assert.equal(bindCensusStatistics(db, measure, ids, true)?.length, 2);
		measure.sources.pop();
		measure.sources[1]!.coverage.recordCount = 2;
		assert.equal(bindCensusStatistics(db, measure, ids), undefined);
	} finally {
		db.close();
	}
});

test("uses reviewed source mappings only when each requested period exists", () => {
	const db = new DatabaseSync(":memory:");
	try {
		db.exec(`CREATE TABLE dataset (id INTEGER, slug TEXT);
			CREATE TABLE measure (id INTEGER, slug TEXT);
			CREATE TABLE series (id INTEGER, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER);
			CREATE TABLE area_releases (position INTEGER, geography TEXT, id TEXT);
			CREATE TABLE dimension (id INTEGER, slug TEXT);
			CREATE TABLE dimension_member (id INTEGER, code TEXT);
			CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
			CREATE TABLE observation (series_id INTEGER, period_id INTEGER);
			CREATE TABLE period (id INTEGER, label TEXT);
			CREATE TABLE dataset_leaf (series_id INTEGER, period_id INTEGER, dataset_id INTEGER, kind TEXT, path TEXT);
			INSERT INTO dataset VALUES (1, 'population');
			INSERT INTO measure VALUES (1, 'population');
			INSERT INTO series VALUES (1, 1, 1, 1);
			INSERT INTO area_releases VALUES (1, 'ward', 'ward-2021');
			INSERT INTO dimension VALUES (1, 'sex'), (2, 'age');
			INSERT INTO dimension_member VALUES (1, 'all'), (2, '0');
			INSERT INTO series_member VALUES (1, 1, 1), (1, 2, 2);
			INSERT INTO period VALUES (1, '2021');
			INSERT INTO observation VALUES (1, 1);`);
		const measure = {
			id: "population",
			sources: [
				{
					datasetId: "population",
					periods: ["2021"],
					sourceGeography: { type: "ward", boundaryYear: 2021 },
				},
			],
		} as unknown as Measure;
		const reviewed: StatisticsReadPath = {
			schemaVersion: 1,
			statistics: {
				[observationArtifactName(measure.id, measure.sources[0]!)]: {
					datasetId: "population",
					measure: "population",
					geography: "ward",
					dimensions: { sex: "all", age: "0" },
				},
			},
			observations: {},
		};
		assert.equal(bindReviewedStatistics(db, measure, reviewed)?.length, 1);
		// A selector that serves values its series do not hold as they are.
		const zeroed = {
			...reviewed,
			statistics: Object.fromEntries(
				Object.entries(reviewed.statistics).map(([name, selector]) => [
					name,
					{ ...selector, absentAsZero: true },
				]),
			),
		} as StatisticsReadPath;
		assert.equal(bindReviewedStatistics(db, measure, zeroed), undefined);
		measure.sources[0]!.periods.push("2022");
		assert.equal(bindReviewedStatistics(db, measure, reviewed), undefined);
	} finally {
		db.close();
	}
});

test("exports house prices under the publisher's ward code and release", () => {
	const db = new DatabaseSync(":memory:");
	const directory = mkdtempSync(join(tmpdir(), "house-price-export-"));
	try {
		db.exec(`CREATE TABLE dataset (id INTEGER, slug TEXT);
			CREATE TABLE measure (id INTEGER, slug TEXT, unit TEXT);
			CREATE TABLE series (id INTEGER, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, key TEXT);
			CREATE TABLE area_releases (position INTEGER, geography TEXT, id TEXT);
			CREATE TABLE area (id INTEGER, code TEXT);
			CREATE TABLE area_version (id INTEGER, area_id INTEGER, release_id INTEGER);
			CREATE TABLE period (id INTEGER, label TEXT);
			CREATE TABLE status (id INTEGER, slug TEXT);
			CREATE TABLE dimension (id INTEGER, slug TEXT);
			CREATE TABLE dimension_member (id INTEGER, code TEXT);
			CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
			CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, lower REAL, upper REAL, category_id INTEGER, status_id INTEGER);
			CREATE TABLE dataset_leaf (series_id INTEGER, period_id INTEGER, dataset_id INTEGER, kind TEXT, path TEXT);
			CREATE TABLE dataset_record (dataset_id INTEGER, part INTEGER, records TEXT, position INTEGER, area_version_id INTEGER);
			CREATE TABLE dataset_record_parent (dataset_id INTEGER, part INTEGER, records TEXT, position INTEGER, parent INTEGER, area_version_id INTEGER);
			INSERT INTO dataset VALUES (1, 'house-price');
			INSERT INTO measure VALUES (1, 'house-price-median', 'gbp');
			INSERT INTO area_releases VALUES (1, 'ward', '2021-12-uk-bgc'), (2, 'ward', '2020-12-uk-bgc');
			INSERT INTO area VALUES (1, 'E-new'), (2, 'E-old');
			INSERT INTO area_version VALUES (1, 1, 1), (2, 2, 2);
			INSERT INTO series VALUES (1, 1, 1, 1, 'prices');
			INSERT INTO period VALUES (1, '2022');
			INSERT INTO status VALUES (1, 'observed');
			INSERT INTO observation VALUES (1, 1, 1, 150000, NULL, NULL, NULL, 1);
			INSERT INTO dataset_record VALUES (1, 0, 'data', 1, 1);
			INSERT INTO dataset_record_parent VALUES (1, 0, 'data', 1, 1, 2);`);
		const paths = {
			csv: join(directory, "rows.csv"),
			parquet: join(directory, "rows.parquet"),
		};
		assert.equal(
			exportStatisticsMeasure(db, "house-price-median", paths),
			1,
		);
		const rows = Papa.parse<Record<string, unknown>>(
			readFileSync(paths.csv, "utf8"),
			{
				header: true,
				dynamicTyping: (field) =>
					["value", "lower", "upper"].includes(String(field)),
				skipEmptyLines: true,
				transform: (value) => (value === "" ? null : value),
			},
		);
		assert.deepEqual(
			rows.data,
			readParquet(readFileSync(paths.parquet)).rows,
		);
		assert.equal(rows.data[0]?.area_code, "E-old");
		assert.equal(rows.data[0]?.release, "2020-12-uk-bgc");
	} finally {
		db.close();
		rmSync(directory, { recursive: true, force: true });
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
			INSERT INTO dimension_member VALUES (1, 'rented'), (2, 'owned'), (100, 'LAB');
			INSERT INTO series VALUES (1, 1, 1, 1, 'rented'), (2, 1, 1, 1, 'owned');
			INSERT INTO series_member VALUES (1, 1, 1), (2, 1, 2);
			INSERT INTO area_releases VALUES (1, 'ward', '2021');
			INSERT INTO area VALUES (1, 'E01'), (2, 'E02');
			INSERT INTO area_version VALUES (1, 1), (2, 2);
			INSERT INTO period VALUES (1, '2021');
			INSERT INTO dataset_part VALUES (1, 0, '2021');
			INSERT INTO dataset_leaf VALUES (1, 0, 'data', '["rented"]', 'value', 1, 1), (1, 0, 'data', '["owned"]', 'value', 2, 1);
			INSERT INTO status VALUES (1, 'observed'), (2, 'suppressed');
			INSERT INTO observation VALUES (1, 2, 1, 10, 9, 11, NULL, 1), (2, 1, 1, NULL, NULL, NULL, 100, 2);
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
		assert.equal(csv.data[0]?.category, "LAB");
		assert.deepEqual(
			csv.data.map((row) => row.dimension_tenure),
			["owned", "rented"],
		);
		db.exec(`
			INSERT INTO dataset VALUES (2, 'unemployment');
			INSERT INTO measure VALUES (2, 'unemployment-rate', 'percent'), (3, 'unemployment-rate-interval', 'percentage points');
			INSERT INTO series VALUES (3, 2, 2, 1, 'rate'), (4, 2, 3, 1, 'interval');
			INSERT INTO observation VALUES (3, 1, 1, 10.2, NULL, NULL, NULL, 1), (4, 1, 1, 1.1, NULL, NULL, NULL, 1), (3, 2, 1, 4.3, NULL, NULL, NULL, 1);
		`);
		assert.equal(
			exportStatisticsMeasure(db, "unemployment-rate", paths),
			2,
		);
		const intervals = Papa.parse<Record<string, unknown>>(
			readFileSync(paths.csv, "utf8"),
			{
				header: true,
				dynamicTyping: (field) =>
					["value", "lower", "upper"].includes(String(field)),
				skipEmptyLines: true,
				transform: (value) => (value === "" ? null : value),
			},
		);
		assert.deepEqual(
			intervals.data,
			readParquet(readFileSync(paths.parquet)).rows,
		);
		assert.deepEqual(
			intervals.data.map(({ lower, upper }) => [lower, upper]),
			[
				[9.1, 11.3],
				[null, null],
			],
		);
		db.exec(`DELETE FROM observation WHERE series_id IN (3, 4);
			DELETE FROM series WHERE id IN (3, 4);
			DELETE FROM measure WHERE id IN (2, 3);
			DELETE FROM dataset WHERE id = 2;`);
		db.exec(`INSERT INTO dataset VALUES (2, 'population-uk');
			INSERT INTO measure VALUES (2, 'population', 'people');
			INSERT INTO series VALUES (3, 2, 2, 1, 'age-0'), (4, 2, 2, 1, 'age-1');
			INSERT INTO observation VALUES (3, 1, 1, 10, NULL, NULL, NULL, 1), (4, 1, 1, 12, NULL, NULL, NULL, 1), (3, 2, 1, 3, NULL, NULL, NULL, 1), (4, 2, 1, 4, NULL, NULL, NULL, 1);`);
		assert.equal(exportStatisticsMeasure(db, "population", paths), 2);
		const population = Papa.parse<Record<string, unknown>>(
			readFileSync(paths.csv, "utf8"),
			{
				header: true,
				dynamicTyping: (field) =>
					["value", "lower", "upper"].includes(String(field)),
				skipEmptyLines: true,
				transform: (value) => (value === "" ? null : value),
			},
		);
		assert.deepEqual(
			population.data,
			readParquet(readFileSync(paths.parquet)).rows,
		);
		assert.deepEqual(
			population.data.map(({ value }) => value),
			[22, 7],
		);
		db.exec(`INSERT INTO dataset VALUES (3, 'land-area');
			INSERT INTO measure VALUES (3, 'area', 'hectares');
			INSERT INTO series VALUES (5, 3, 3, 1, 'land');
			INSERT INTO dimension VALUES (2, 'surface');
			INSERT INTO dimension_member VALUES (3, 'land');
			INSERT INTO series_member VALUES (5, 2, 3);
			INSERT INTO period VALUES (2, '2024');
			INSERT INTO observation VALUES (5, 1, 2, 100, NULL, NULL, NULL, 1), (5, 2, 2, 200, NULL, NULL, NULL, 1);`);
		assert.equal(
			exportStatisticsMeasure(db, "population-density", paths, [
				{
					dataset: "population-uk",
					measure: "population",
					members: {},
					geography: "ward",
					release: "2021",
					periods: ["2021"],
				},
			]),
			2,
		);
		const density = Papa.parse<Record<string, unknown>>(
			readFileSync(paths.csv, "utf8"),
			{
				header: true,
				dynamicTyping: (field) =>
					["value", "lower", "upper"].includes(String(field)),
				skipEmptyLines: true,
				transform: (value) => (value === "" ? null : value),
			},
		);
		assert.deepEqual(
			density.data,
			readParquet(readFileSync(paths.parquet)).rows,
		);
		assert.deepEqual(
			density.data.map(({ value, status }) => [value, status]),
			[
				[22, "derived"],
				[3.5, "derived"],
			],
		);
		db.exec(`DELETE FROM observation WHERE series_id = 5;
			DELETE FROM series_member WHERE series_id = 5;
			DELETE FROM series WHERE id = 5;
			DELETE FROM dimension WHERE id = 2;
			DELETE FROM dimension_member WHERE id = 3;
			DELETE FROM period WHERE id = 2;
			DELETE FROM measure WHERE id = 3;
			DELETE FROM dataset WHERE id = 3;`);
		db.exec(`DELETE FROM observation WHERE series_id IN (3, 4);
			DELETE FROM series WHERE id IN (3, 4);
			DELETE FROM measure WHERE id = 2;
			DELETE FROM dataset WHERE id = 2;`);
		db.exec(`INSERT INTO dataset VALUES (2, 'general-election'), (3, 'local-election');
			INSERT INTO measure VALUES (2, 'valid-votes', 'votes'), (3, 'party-votes', 'votes'), (4, 'electorate', 'electors'), (5, 'rejected-ballots', 'ballots');
			INSERT INTO dimension VALUES (2, 'party');
			INSERT INTO dimension_member VALUES (3, 'con'), (4, 'lab');
			INSERT INTO series VALUES (3, 2, 2, 1, 'valid'), (4, 2, 3, 1, 'con'), (5, 2, 4, 1, 'electorate'), (6, 2, 5, 1, 'rejected'), (7, 3, 3, 1, 'local-con'), (8, 3, 3, 1, 'local-lab');
			INSERT INTO series_member VALUES (4, 2, 3), (7, 2, 3), (8, 2, 4);
			INSERT INTO observation VALUES (3, 1, 1, 100, NULL, NULL, NULL, 1), (3, 2, 1, 200, NULL, NULL, NULL, 1), (4, 1, 1, 10, NULL, NULL, NULL, 1), (5, 1, 1, 125, NULL, NULL, NULL, 1), (5, 2, 1, 250, NULL, NULL, NULL, 1), (6, 1, 1, 5, NULL, NULL, NULL, 1), (6, 2, 1, 10, NULL, NULL, NULL, 1), (7, 1, 1, 10, NULL, NULL, NULL, 1), (8, 1, 1, 20, NULL, NULL, NULL, 1), (8, 2, 1, 30, NULL, NULL, NULL, 1);`);
		for (const [id, values] of [
			["general-election-con-votes", [10, 0]],
			["general-election-con-vote-share", [10, 0]],
			["general-election-turnout", [84, 84]],
			["local-election-con-votes", [10, 0]],
			["local-election-effective-votes", [30, 30]],
		] as const) {
			assert.equal(exportStatisticsMeasure(db, id, paths), 2);
			const rows = Papa.parse<Record<string, unknown>>(
				readFileSync(paths.csv, "utf8"),
				{
					header: true,
					dynamicTyping: (field) =>
						["value", "lower", "upper"].includes(String(field)),
					skipEmptyLines: true,
					transform: (value) => (value === "" ? null : value),
				},
			);
			assert.deepEqual(
				rows.data,
				readParquet(readFileSync(paths.parquet)).rows,
			);
			assert.deepEqual(
				rows.data.map(({ value }) => value),
				values,
			);
		}
		db.exec(`DELETE FROM observation WHERE series_id BETWEEN 3 AND 8;
			DELETE FROM series_member WHERE series_id IN (4, 7, 8);
			DELETE FROM series WHERE id BETWEEN 3 AND 8;
			DELETE FROM dimension WHERE id = 2;
			DELETE FROM dimension_member WHERE id IN (3, 4);
			DELETE FROM measure WHERE id BETWEEN 2 AND 5;
			DELETE FROM dataset WHERE id IN (2, 3);`);
		exportStatisticsMeasure(db, "households", paths);
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
		db.exec(`UPDATE dataset SET slug = 'jobs';
			UPDATE dataset_leaf SET path = '["totalJobs"]' WHERE path = '["rented"]'`);
		const jobs = {
			id: "total-jobs",
			sources: [{ datasetId: "jobs" }],
		} as unknown as Measure;
		const jobsSelection = bindCompiledFields(db, jobs);
		assert.ok(jobsSelection);
		assert.equal(
			exportStatisticsMeasure(db, "total-jobs", paths, jobsSelection),
			2052,
		);
		jobs.sources.push({ datasetId: "other" } as Measure["sources"][number]);
		assert.equal(bindCompiledFields(db, jobs), undefined);
	} finally {
		db.close();
		rmSync(directory, { recursive: true, force: true });
	}
});
