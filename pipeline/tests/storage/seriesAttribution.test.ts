import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "vitest";
import {
	checkSeriesAttribution,
	writeSeriesAttribution,
} from "../../src/storage/seriesAttribution.ts";

/**
 * Sources: 1 ONS (OGL), 2 VOA (OGL), 3 weights source (OGL), 4 crosswalk
 * provenance (OGL), 5 boundaries (ONS, OGL), 6 elections (OPL for 2021, CC BY-SA
 * for 2017), 7 a source with no licence on record, 8 a second election source
 * reached by a dataset reference.
 *
 * Series: 1 published population (dataset 1, ONS), 2 published housing
 * (dataset 2, VOA), 3 converted from 1 across crosswalk 1, 4 ratio of 3 and 2,
 * 5 and 6 local election series (dataset 3) holding the 2021 and 2017
 * elections, 7 a published series from the unknown source, 8 and 9 two models
 * of 2024 results reading 5 and 6 (open and ShareAlike).
 */
const fixture = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE licence (id TEXT PRIMARY KEY, name TEXT, url TEXT, commercial_use INTEGER, share_alike INTEGER, attribution TEXT NOT NULL);
		INSERT INTO licence VALUES
			('ogl-3.0', 'OGL', 'u', 1, 0, 'Contains public sector information licensed under the Open Government Licence v3.0'),
			('open-parliament', 'OPL', 'u', 1, 0, 'Contains Parliamentary information licensed under the Open Parliament Licence v3.0'),
			('cc-by-sa-3.0', 'CC BY-SA', 'u', 1, 1, 'Licensed under CC BY-SA 3.0, and any adaptation must be shared under the same licence'),
			('noncommercial', 'NC', 'u', 0, 0, 'Non commercial use only');
		CREATE TABLE source (id INTEGER PRIMARY KEY, publisher TEXT NOT NULL, url TEXT, licence TEXT NOT NULL, licence_url TEXT, citation TEXT);
		INSERT INTO source VALUES
			(1, 'Office for National Statistics', 'u1', 'OGL', NULL, NULL),
			(2, 'Valuation Office Agency', 'u2', 'OGL', NULL, NULL),
			(3, 'Weights Office', 'u3', 'OGL', NULL, 'Contains Royal Mail data © Royal Mail copyright and database right
Source: Weights Office'),
			(4, 'Crosswalk Office', 'u4', 'OGL', NULL, NULL),
			(5, 'Office for National Statistics', 'u5', 'OGL', NULL, NULL),
			(6, 'Elections Archive', 'u6', 'both', NULL, NULL),
			(7, 'Unlicensed Publisher', 'u7', 'none', NULL, NULL);
		CREATE TABLE source_licence (source_id INTEGER, licence_id TEXT, PRIMARY KEY (source_id, licence_id));
		INSERT INTO source_licence VALUES (1, 'ogl-3.0'), (2, 'ogl-3.0'), (3, 'ogl-3.0'), (4, 'ogl-3.0'), (5, 'ogl-3.0'), (6, 'open-parliament'), (6, 'cc-by-sa-3.0');
		CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT, source_id INTEGER);
		INSERT INTO dataset VALUES (1, 'population', 1), (2, 'housing', 2), (3, 'local-election', 6), (4, 'unlicensed', 7);
		CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT);
		INSERT INTO period VALUES (1, '2021-05-06'), (2, '2017-05-04'), (3, '2021');
		CREATE TABLE election (id INTEGER PRIMARY KEY, dataset_id INTEGER, date TEXT);
		INSERT INTO election VALUES (1, 3, '2021-05-06'), (2, 3, '2017-05-04');
		CREATE TABLE election_licence (election_id INTEGER, licence_id TEXT, PRIMARY KEY (election_id, licence_id));
		INSERT INTO election_licence VALUES (1, 'open-parliament'), (2, 'cc-by-sa-3.0');
		CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
		INSERT INTO measure VALUES (1, 'population'), (2, 'dwellings'), (3, 'ratio'), (4, 'votes');
		CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT, publisher TEXT, reference_year INTEGER);
		INSERT INTO area_release VALUES (1, 'ward', '2021', 'Office for National Statistics', 2021), (2, 'ward', '2024', 'Office for National Statistics', 2024);
		CREATE TABLE boundary_release_source (release_id INTEGER, source_id INTEGER);
		INSERT INTO boundary_release_source VALUES (1, 5), (2, 5);
		CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT, derived_from_id INTEGER, key TEXT UNIQUE);
		INSERT INTO series VALUES
			(1, 1, 1, 1, 'published', NULL, 'population/ward:2021'),
			(2, 2, 2, 2, 'published', NULL, 'housing/ward:2024'),
			(3, 1, 1, 2, 'converted', 1, 'population/ward:2024'),
			(4, 1, 3, 2, 'aggregated', 3, 'ratio/ward:2024'),
			(5, 3, 4, 1, 'published', NULL, 'election/ward:2021'),
			(6, 3, 4, 1, 'published', NULL, 'election/ward:2017'),
			(7, 4, 1, 1, 'published', NULL, 'unlicensed/ward:2021'),
			(8, 3, 4, 2, 'modelled', 2, 'notional-open'),
			(9, 3, 4, 2, 'modelled', 2, 'notional-sharealike');
		CREATE TABLE observation (series_id INTEGER, period_id INTEGER, PRIMARY KEY (series_id, period_id));
		INSERT INTO observation VALUES (1, 3), (2, 3), (3, 3), (4, 3), (5, 1), (6, 2), (7, 3), (8, 1), (9, 2);
		CREATE TABLE series_input (series_id INTEGER, input_series_id INTEGER, role TEXT, PRIMARY KEY (series_id, input_series_id));
		INSERT INTO series_input VALUES (3, 1, 'value'), (4, 3, 'numerator'), (4, 2, 'denominator');
		CREATE TABLE crosswalk (id INTEGER PRIMARY KEY, basis_id TEXT);
		INSERT INTO crosswalk VALUES (1, 'population');
		CREATE TABLE series_crosswalk (series_id INTEGER, position INTEGER, crosswalk_id INTEGER, reversed INTEGER, PRIMARY KEY (series_id, position));
		INSERT INTO series_crosswalk VALUES (3, 0, 1, 0);
		CREATE TABLE crosswalk_provenance_source (crosswalk_id INTEGER, source_id INTEGER, input TEXT);
		INSERT INTO crosswalk_provenance_source VALUES (1, 4, 'x');
		CREATE TABLE weight_basis (id TEXT PRIMARY KEY, label TEXT);
		INSERT INTO weight_basis VALUES ('population', 'Residents');
		CREATE TABLE crosswalk_input_source (input TEXT PRIMARY KEY, source_id INTEGER);
		INSERT INTO crosswalk_input_source VALUES ('weights-file', 3);
		CREATE TABLE crosswalk_weight_input (crosswalk_id INTEGER, basis_id TEXT, input TEXT);
		INSERT INTO crosswalk_weight_input VALUES (1, 'population', 'weights-file');
		CREATE TABLE model (id TEXT PRIMARY KEY, label TEXT, licence_id TEXT);
		INSERT INTO model VALUES ('open', 'Open', NULL), ('sharealike', 'ShareAlike', 'cc-by-sa-3.0');
		CREATE TABLE series_model (series_id INTEGER PRIMARY KEY, model_id TEXT);
		INSERT INTO series_model VALUES (8, 'open'), (9, 'sharealike');
		CREATE TABLE model_input (model_id TEXT, role TEXT, key TEXT, PRIMARY KEY (model_id, role, key));
		INSERT INTO model_input VALUES
			('open', 'local election 2021-05-06', 'election/ward:2021'),
			('open', 'weights', 'weights:population (2019 to 2024)'),
			('sharealike', 'local election 2021-05-06', 'election/ward:2021'),
			('sharealike', 'local election 2017-05-04', 'dataset:local-election (leap-2017.csv)'),
			('sharealike', 'weights', 'weights:population');
	`);
	return database;
};

const terms = (database: DatabaseSync, key: string) =>
	database
		.prepare("SELECT * FROM v_series_terms WHERE series = ?")
		.get(key) as Record<string, unknown>;

const sourcesOf = (database: DatabaseSync, key: string) =>
	(
		database
			.prepare(
				"SELECT source_id, via, vias, depth FROM v_series_attribution WHERE series = ? ORDER BY source_id",
			)
			.all(key) as unknown as {
			source_id: number;
			via: string;
			vias: string;
			depth: number;
		}[]
	).map((row) => ({ ...row }));

describe("writeSeriesAttribution", () => {
	test("a published series reaches its dataset source and its boundaries", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		assert.deepEqual(sourcesOf(database, "housing/ward:2024"), [
			{ source_id: 2, via: "dataset", vias: "dataset", depth: 0 },
			{ source_id: 5, via: "boundaries", vias: "boundaries", depth: 1 },
		]);
	});

	test("a converted series adds its input, crosswalk and weight sources", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		assert.deepEqual(sourcesOf(database, "population/ward:2024"), [
			{
				source_id: 1,
				via: "dataset",
				vias: "dataset, input:value",
				depth: 0,
			},
			{
				source_id: 3,
				via: "crosswalk-weight",
				vias: "crosswalk-weight",
				depth: 2,
			},
			{ source_id: 4, via: "crosswalk", vias: "crosswalk", depth: 1 },
			{
				source_id: 5,
				via: "boundaries",
				vias: "input:value, boundaries",
				depth: 1,
			},
		]);
	});

	test("a series built from a chain reaches the sources of every input", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		const ratio = sourcesOf(database, "ratio/ward:2024");
		assert.deepEqual(
			ratio.map((row) => row.source_id),
			[1, 2, 3, 4, 5],
		);
		// The crosswalk source is two edges away: the ratio, its numerator, its crosswalk.
		assert.equal(ratio.find((row) => row.source_id === 4)!.depth, 2);
		assert.equal(
			ratio.find((row) => row.source_id === 4)!.via,
			"input:value",
		);
		assert.equal(
			ratio.find((row) => row.source_id === 2)!.via,
			"input:value",
		);
		checkSeriesAttribution(database);
	});

	test("an election series is under the licence of the elections it holds", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		assert.equal(
			terms(database, "election/ward:2021")!.licences,
			"ogl-3.0, open-parliament",
		);
		assert.equal(terms(database, "election/ward:2021")!.share_alike, 0);
		assert.equal(
			terms(database, "election/ward:2017")!.licences,
			"cc-by-sa-3.0, ogl-3.0",
		);
		assert.equal(terms(database, "election/ward:2017")!.share_alike, 1);
	});

	test("a model is ShareAlike only when it read a ShareAlike election", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		const open = terms(database, "notional-open");
		assert.equal(open.share_alike, 0);
		assert.equal(open.commercial_use, 1);
		assert.ok(!String(open.licences).includes("cc-by-sa"));
		const shareAlike = terms(database, "notional-sharealike");
		assert.equal(shareAlike.share_alike, 1);
		assert.equal(shareAlike.commercial_use, 1);
		assert.ok(String(shareAlike.licences).includes("cc-by-sa-3.0"));
	});

	test("a dataset reference takes the licence of the role date, not every year", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		const rows = database
			.prepare(
				"SELECT licence_id FROM series_source_licence WHERE series_id = 9 AND source_id = 6 ORDER BY licence_id",
			)
			.all() as { licence_id: string }[];
		assert.deepEqual(
			rows.map((row) => row.licence_id),
			["cc-by-sa-3.0", "open-parliament"],
		);
		const open = database
			.prepare(
				"SELECT licence_id FROM series_source_licence WHERE series_id = 8 AND source_id = 6",
			)
			.all() as { licence_id: string }[];
		assert.deepEqual(
			open.map((row) => row.licence_id),
			["open-parliament"],
		);
	});

	test("a weights reference reaches the sources the weights were counted from", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		const weights = sourcesOf(database, "notional-open").find(
			(row) => row.source_id === 3,
		)!;
		assert.equal(weights.via, "model");
		assert.equal(weights.depth, 2);
	});

	test("a source with no licence on record leaves the series unknown", () => {
		const database = fixture();
		const summary = writeSeriesAttribution(database);
		const unknown = terms(database, "unlicensed/ward:2021");
		assert.equal(unknown.commercial_use, null);
		assert.equal(unknown.share_alike, null);
		assert.equal(summary.unknown, 1);
		assert.equal(summary.series, 9);
		assert.equal(summary.shareAlike, 2);
	});

	test("a licence that is not commercial makes the series not commercial", () => {
		const database = fixture();
		database.exec("INSERT INTO source_licence VALUES (2, 'noncommercial')");
		writeSeriesAttribution(database);
		assert.equal(terms(database, "housing/ward:2024")!.commercial_use, 0);
		// And the ratio built from it.
		assert.equal(terms(database, "ratio/ward:2024")!.commercial_use, 0);
		assert.equal(
			terms(database, "population/ward:2024")!.commercial_use,
			1,
		);
	});

	test("the attribution names each publisher and statement once", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		assert.equal(
			terms(database, "population/ward:2024")!.attribution,
			"Source: Office for National Statistics; Crosswalk Office; Weights Office. Contains public sector information licensed under the Open Government Licence v3.0. Contains OS data © Crown copyright and database right 2021 and 2024. Contains Royal Mail data © Royal Mail copyright and database right.",
		);
		assert.equal(
			String(terms(database, "notional-sharealike")!.attribution).match(
				/Open Government Licence/g,
			)!.length,
			1,
		);
	});

	test("the boundary notice carries the year of the series' boundaries", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		assert.match(
			String(terms(database, "housing/ward:2024")!.attribution),
			/database right 2024\.$/,
		);
	});

	test("a model input that names nothing fails the build", () => {
		const database = fixture();
		database.exec(
			"INSERT INTO model_input VALUES ('open', 'general election', 'nothing/ward:2019')",
		);
		assert.throws(
			() => writeSeriesAttribution(database),
			/1 model_input keys name no series, dataset or weight basis:\nopen: general election: nothing\/ward:2019/,
		);
	});

	test("a model licence no input reaches fails the build", () => {
		const database = fixture();
		database.exec(
			"DELETE FROM model_input WHERE model_id = 'sharealike' AND role = 'local election 2017-05-04'; UPDATE series SET dataset_id = 1 WHERE id = 9",
		);
		assert.throws(
			() => writeSeriesAttribution(database),
			/model sharealike declares cc-by-sa-3.0/,
		);
	});

	test("a licence with no attribution statement fails the check", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		database.exec(
			"UPDATE licence SET attribution = ' ' WHERE id = 'noncommercial'",
		);
		assert.throws(
			() => checkSeriesAttribution(database),
			/1 licences have no attribution statement/,
		);
	});

	test("a series with no source fails the check", () => {
		const database = fixture();
		writeSeriesAttribution(database);
		database.exec("DELETE FROM series_source WHERE series_id = 2");
		assert.throws(
			() => checkSeriesAttribution(database),
			/series reach no source/,
		);
	});
});
