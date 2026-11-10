import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, test } from "vitest";
import type { ConvertedSeries } from "../src/conversion/convertSeries.ts";
import {
	assertNothingPassesAsPublished,
	copyConvertedSeries,
	openConvertedWriter,
} from "../src/conversion/storeConverted.ts";
import type { IdRegistries } from "../src/ids/idRegistries.ts";

const directories: string[] = [];
afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

/** The tables of `atlas.sqlite` the copy touches, with the checks `series` has. */
const ATLAS = `
CREATE TABLE series (
	id INTEGER PRIMARY KEY, dataset_id INTEGER NOT NULL, measure_id INTEGER NOT NULL,
	release_id INTEGER NOT NULL,
	method TEXT NOT NULL CHECK (method IN ('published','converted','aggregated','modelled')),
	derived_from_id INTEGER REFERENCES series(id), key TEXT NOT NULL UNIQUE,
	CHECK ((method = 'published') = (derived_from_id IS NULL)));
CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
CREATE TABLE observation (
	series_id INTEGER NOT NULL, area_version_id INTEGER NOT NULL, period_id INTEGER NOT NULL,
	value REAL, status_id INTEGER NOT NULL, lower REAL, upper REAL, category_id INTEGER);
CREATE TABLE crosswalk (id INTEGER PRIMARY KEY, slug TEXT NOT NULL);
CREATE TABLE weight_basis (id TEXT PRIMARY KEY);
CREATE TABLE area_version (id INTEGER PRIMARY KEY);
CREATE TABLE period (id INTEGER PRIMARY KEY);
CREATE TABLE measure (id INTEGER PRIMARY KEY);
INSERT INTO series VALUES (1, 3, 4, 5, 'published', NULL, 'population/ward');
INSERT INTO series_member VALUES (1, 8, 9);
INSERT INTO observation VALUES (1, 100, 2, 40, 1, NULL, NULL, NULL);
INSERT INTO crosswalk VALUES (7, 'ward-to-constituency');
INSERT INTO weight_basis VALUES ('population');
INSERT INTO area_version VALUES (100), (200), (201), (202);
INSERT INTO period VALUES (2);
INSERT INTO measure VALUES (4);
`;

const converted = (fields: Partial<ConvertedSeries> = {}): ConvertedSeries => ({
	planId: "population-onto-constituency",
	key: "population/ward~converted:constituency:2024",
	datasetId: 3,
	measureId: 4,
	releaseId: 6,
	rule: "sum",
	basis: "population",
	inputs: [
		{
			role: "value",
			series: {
				id: 1,
				key: "population/ward",
				dataset: "population",
				measure: "population",
				releaseId: 5,
				members: "",
			},
		},
	],
	crosswalks: [
		{ position: 0, id: 7, slug: "ward-to-constituency", reversed: false },
	],
	note: null,
	periods: 1,
	observations: [
		{
			area: 200,
			period: 2,
			value: 40,
			status: 6,
			lower: null,
			upper: null,
		},
		{ area: 201, period: 2, value: 12, status: 2, lower: 10, upper: 14 },
	],
	gaps: [{ area: 202, period: 2, reason: "unmeasured-split" }],
	...fields,
});

const atlasWith = (...series: ConvertedSeries[]) => {
	const directory = mkdtempSync(join(tmpdir(), "converted-"));
	directories.push(directory);
	const path = join(directory, "converted-series.sqlite");
	const writer = openConvertedWriter(path);
	for (const entry of series) writer.add(entry);
	writer.finish();
	const database = new DatabaseSync(":memory:");
	database.exec(ATLAS);
	database.prepare("ATTACH DATABASE ? AS converted_component").run(path);
	return database;
};

const registries = () => {
	let next = 50;
	const assigned: string[] = [];
	return {
		assigned,
		ids: {
			series: {
				assign: (key: string) => {
					assigned.push(key);
					return next++;
				},
			},
		} as unknown as IdRegistries,
	};
};

test("a copied series is marked converted, names its inputs, and holds no observed value", () => {
	const database = atlasWith(converted());
	const { ids, assigned } = registries();
	assert.deepEqual(copyConvertedSeries(database, ids), {
		series: 1,
		observations: 2,
	});
	assert.deepEqual(assigned, ["population/ward~converted:constituency:2024"]);
	assert.deepEqual(
		{ ...database.prepare("SELECT * FROM series WHERE id = 50").get() },
		{
			id: 50,
			dataset_id: 3,
			measure_id: 4,
			release_id: 6,
			method: "converted",
			derived_from_id: 1,
			key: "population/ward~converted:constituency:2024",
		},
	);
	assert.deepEqual(
		database
			.prepare(
				"SELECT area_version_id AS area, status_id AS status, lower, upper FROM observation WHERE series_id = 50 ORDER BY 1",
			)
			.all()
			.map((row) => ({ ...row })),
		[
			{ area: 200, status: 6, lower: null, upper: null },
			{ area: 201, status: 2, lower: 10, upper: 14 },
		],
	);
	const one = (sql: string) => ({ ...database.prepare(sql).get() });
	assert.deepEqual(one("SELECT * FROM series_input"), {
		series_id: 50,
		input_series_id: 1,
		role: "value",
	});
	// Some values are estimated, so the series is not exact.
	assert.deepEqual(one("SELECT * FROM series_conversion"), {
		series_id: 50,
		rule: "sum",
		basis_id: "population",
		exact: 0,
		note: null,
	});
	assert.deepEqual(one("SELECT * FROM series_crosswalk"), {
		series_id: 50,
		position: 0,
		crosswalk_id: 7,
		reversed: 0,
	});
	assert.deepEqual(one("SELECT * FROM series_gap"), {
		series_id: 50,
		area_version_id: 202,
		period_id: 2,
		reason: "unmeasured-split",
	});
	// The series keeps the members of the one it derives from.
	assert.deepEqual(
		one(
			"SELECT dimension_id, member_id FROM series_member WHERE series_id = 50",
		),
		{ dimension_id: 8, member_id: 9 },
	);
	// The published series is untouched.
	assert.equal(
		one("SELECT count(*) AS n FROM observation WHERE status_id = 1").n,
		1,
	);
});

test("a series of regroupings alone is exact", () => {
	const database = atlasWith(
		converted({ observations: [converted().observations[0]!] }),
	);
	copyConvertedSeries(database, registries().ids);
	assert.equal(
		database.prepare("SELECT exact FROM series_conversion").get()?.exact,
		1,
	);
});

test("the copy fails where the component was computed from another base", () => {
	const input = converted().inputs[0]!;
	const renamed = atlasWith(
		converted({
			inputs: [
				{ ...input, series: { ...input.series, key: "another/key" } },
			],
		}),
	);
	assert.throws(
		() => copyConvertedSeries(renamed, registries().ids),
		/another set of published series/,
	);
	const rerouted = atlasWith(
		converted({
			crosswalks: [
				{ position: 0, id: 7, slug: "another-slug", reversed: false },
			],
		}),
	);
	assert.throws(
		() => copyConvertedSeries(rerouted, registries().ids),
		/another set of crosswalks/,
	);
});

test("a converted series cannot be an input of another", () => {
	const database = atlasWith(converted());
	const { ids } = registries();
	copyConvertedSeries(database, ids);
	const input = converted().inputs[0]!;
	const chained = atlasWith(
		converted({
			key: "second",
			inputs: [
				{
					...input,
					series: {
						...input.series,
						id: 50,
						key: "population/ward~converted:constituency:2024",
					},
				},
			],
		}),
	);
	chained.exec(
		"INSERT INTO series VALUES (50, 3, 4, 6, 'converted', 1, 'population/ward~converted:constituency:2024')",
	);
	assert.throws(
		() => copyConvertedSeries(chained, ids),
		/another set of published series/,
	);
});

test("an observed value on a series that is not published fails the check", () => {
	const database = new DatabaseSync(":memory:");
	database.exec(ATLAS);
	assertNothingPassesAsPublished(database);
	database.exec(
		"INSERT INTO series VALUES (2, 3, 4, 6, 'converted', 1, 'converted'); INSERT INTO observation VALUES (2, 200, 2, 40, 1, NULL, NULL, NULL)",
	);
	assert.throws(
		() => assertNothingPassesAsPublished(database),
		/1 values of series that are not published/,
	);
	// The database itself refuses a converted series that names no source.
	assert.throws(() =>
		database.exec(
			"INSERT INTO series VALUES (3, 3, 4, 6, 'converted', NULL, 'orphan')",
		),
	);
});
