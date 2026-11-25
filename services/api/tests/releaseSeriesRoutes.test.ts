import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, test } from "vitest";
import {
	measureSeriesSourceKey,
	readAreaPeriodChanges,
	type StatisticsReadPath,
} from "@uk-data-atlas/measures";
import { reportRequest as routeRequest } from "./evidenceFixtures";
import { dataCatalog, testContext } from "./contextFixtures";

/**
 * Population on two local authority releases: 2023 publishes 2022 and 2023,
 * and both were converted onto 2026, where E06000099 was made since; 2026
 * publishes 2024 itself.
 */
const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-release-series-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const databasePath = join(root, "atlas.sqlite");
const database = new DatabaseSync(databasePath);
database.exec(`
	CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
	CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT, key TEXT);
	CREATE TABLE dimension (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE dimension_member (id INTEGER PRIMARY KEY, code TEXT);
	CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
	CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
	CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER, name TEXT);
	CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT, start_date TEXT);
	CREATE TABLE status (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, status_id INTEGER, lower REAL, upper REAL, PRIMARY KEY (series_id, area_version_id, period_id));
	CREATE TABLE series_input (series_id INTEGER, input_series_id INTEGER, role TEXT);
	CREATE TABLE series_conversion (series_id INTEGER PRIMARY KEY, rule TEXT, basis_id TEXT, exact INTEGER, exact_share REAL, coverage REAL, note TEXT);
	CREATE TABLE crosswalk (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE series_crosswalk (series_id INTEGER, position INTEGER, crosswalk_id INTEGER, reversed INTEGER);
	CREATE TABLE series_gap (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, reason TEXT);
	CREATE TABLE series_estimate (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, estimated_share REAL);
	CREATE TABLE measure_conversion (measure_id INTEGER PRIMARY KEY, rule TEXT, split_basis_id TEXT, reason TEXT);
	CREATE TABLE conversion_skip (dataset_id INTEGER, measure_id INTEGER, source_release_id INTEGER, target_release_id INTEGER, reason TEXT, series INTEGER);
	INSERT INTO dataset VALUES (1, 'population-uk');
	INSERT INTO measure VALUES (1, 'population');
	INSERT INTO area_release VALUES (1, 'localAuthority', '2023-12-uk-bgc'), (2, 'localAuthority', '2026-05-uk-bgc');
	INSERT INTO status VALUES (1, 'observed'), (2, 'estimated'), (6, 'derived');
	INSERT INTO period VALUES (1, '2022', '2022-01-01'), (2, '2023', '2023-01-01'), (3, '2024', '2024-01-01');
	INSERT INTO area VALUES (1, 'E06000001'), (2, 'E06000099');
	INSERT INTO area_version VALUES (11, 1, 1, 'Hartlepool'), (12, 1, 2, 'Hartlepool'), (22, 2, 2, 'New Town');
	INSERT INTO crosswalk VALUES (1, 'local-authority-2023-to-2026');
	INSERT INTO series VALUES
		(1, 1, 1, 1, 'published', 'population@2023'),
		(2, 1, 1, 2, 'published', 'population@2026'),
		(10, 1, 1, 2, 'converted', 'population@2023~converted:localAuthority:2026-05-uk-bgc');
	INSERT INTO observation VALUES
		(1, 11, 1, 92000, 1, NULL, NULL), (1, 11, 2, 92500, 1, NULL, NULL),
		(2, 12, 3, 93000, 1, NULL, NULL), (2, 22, 3, 5000, 1, NULL, NULL),
		(10, 12, 1, 92000, 6, NULL, NULL), (10, 12, 2, 92500, 6, NULL, NULL),
		(10, 22, 1, 4800, 2, 4500, 5100);
	INSERT INTO series_gap VALUES (10, 22, 2, 'missing-input');
	INSERT INTO series_estimate VALUES (10, 22, 1, 1);
	INSERT INTO series_input VALUES (10, 1, 'value');
	INSERT INTO series_conversion VALUES (10, 'sum', 'population', 0, 0.99, 1, NULL);
	INSERT INTO series_crosswalk VALUES (10, 0, 1, 0);
	INSERT INTO measure_conversion VALUES (1, 'sum', 'population', 'A count adds across areas.');
`);
database.close();

const measure = dataCatalog.measures.find((m) => m.id === "population")!;
const readPath: StatisticsReadPath = {
	schemaVersion: 1,
	dataCatalogHash: dataCatalog.contentHash,
	observations: {},
	series: Object.fromEntries(
		measure.sources.map((source) => [
			measureSeriesSourceKey(measure.series!, source),
			{
				datasetId: "population-uk",
				measure: "population",
				dimensions: {},
				geography: "localAuthority",
			},
		]),
	),
};

const get = (url: string, statistics = { databasePath, readPath }) =>
	routeRequest(
		"GET",
		url,
		testContext({ dataCatalog, atlasStatistics: statistics }),
	);
const data = (response: ReturnType<typeof get>) =>
	(response.body as { data: Record<string, unknown> }).data;
const on = "on=localAuthority/2026-05-uk-bgc";

test("serves a series rebuilt on one release, each value naming its method", () => {
	const response = get(`/v1/data/population/series?place=E06000001&${on}`);
	assert.equal(response.status, 200);
	const body = data(response);
	assert.equal(body.areaName, "Hartlepool");
	assert.deepEqual(body.on, {
		geography: "localAuthority",
		boundaryRelease: "2026-05-uk-bgc",
	});
	assert.deepEqual(body.series, [
		{
			period: "2022",
			value: 92000,
			status: "derived",
			method: "exact",
			source: {
				release: "localAuthority:2023-12-uk-bgc",
				rule: "sum",
				basis: "population",
				crosswalks: ["local-authority-2023-to-2026"],
				seriesCoverage: 1,
			},
		},
		{
			period: "2023",
			value: 92500,
			status: "derived",
			method: "exact",
			source: {
				release: "localAuthority:2023-12-uk-bgc",
				rule: "sum",
				basis: "population",
				crosswalks: ["local-authority-2023-to-2026"],
				seriesCoverage: 1,
			},
		},
		// The release's own value, unchanged.
		{ period: "2024", value: 93000, status: "observed", method: "native" },
	]);
	assert.deepEqual(body.summary, {
		periods: 3,
		first: "2022",
		last: "2024",
		native: 1,
		exact: 2,
		weighted: 0,
		gaps: 0,
		convertedShare: 2 / 3,
		warnings: [],
	});
});

test("warns of a weighted value, a new area and a gap", () => {
	const body = data(get(`/v1/data/population/series?place=E06000099&${on}`));
	const [split] = body.series as Array<Record<string, unknown>>;
	assert.equal(split!.method, "weighted");
	assert.equal(split!.exactShare, 0);
	// The split carries the bounds the conversion stored, under its own name.
	assert.deepEqual(split!.bounds, { lower: 4500, upper: 5100 });
	assert.equal(split!.confidenceInterval, undefined);
	// The release's own value and the regrouped values carry none.
	const native = (body.series as Array<Record<string, unknown>>).at(-1)!;
	assert.equal(native.method, "native");
	assert.equal(native.bounds, undefined);
	assert.deepEqual(split!.flags, [
		"area-not-on-source-release",
		"low-exact-share",
	]);
	assert.deepEqual(body.gaps, [
		{
			period: "2023",
			sources: [
				{
					release: "localAuthority:2023-12-uk-bgc",
					reason: "missing-input",
				},
			],
		},
	]);
	const summary = body.summary as { warnings: Array<{ code: string }> };
	assert.deepEqual(
		summary.warnings.map((w) => w.code),
		["weighted", "low-exact-share", "area-not-on-source-release", "gaps"],
	);
});

test("refuses a release that is not a standard one", () => {
	const response = get(
		"/v1/data/population/series?place=E06000001&on=localAuthority/2023-12-uk-bgc",
	);
	assert.equal(response.status, 422);
	assert.match(
		JSON.stringify(response.body),
		/localAuthority\/2026-05-uk-bgc/,
	);
});

test("refuses an area that is not on the release", () => {
	assert.equal(
		get(`/v1/data/population/series?place=E06000002&${on}`).status,
		404,
	);
});

test("refuses on= without a pair, or with to=", () => {
	assert.equal(
		get("/v1/data/population/series?place=E06000001&on=localAuthority")
			.status,
		400,
	);
	assert.equal(
		get(
			`/v1/data/population/series?place=E06000001&${on}&to=localAuthority/2026-05-uk-bgc`,
		).status,
		400,
	);
});

test("refuses a measure whose selector cannot be read on another release", () => {
	const contest: StatisticsReadPath = {
		...readPath,
		series: Object.fromEntries(
			Object.entries(readPath.series!).map(([key, selector]) => [
				key,
				{ ...selector, contest: "winner" as const },
			]),
		),
	};
	const response = get(`/v1/data/population/series?place=E06000001&${on}`, {
		databasePath,
		readPath: contest,
	});
	assert.equal(response.status, 422);
	assert.match(JSON.stringify(response.body), /category/);
});

/**
 * The same atlas with v_area_period_change: population is a quantity whose
 * age breakdown has its total in the series with no member, and Hartlepool
 * has one adjacent change, published at both ends.
 */
const changesPath = join(root, "atlas-changes.sqlite");
{
	const changes = new DatabaseSync(databasePath);
	changes.exec(`VACUUM INTO '${changesPath}'`);
	changes.close();
	const atlas = new DatabaseSync(changesPath);
	atlas.exec(`
		CREATE TABLE measure_dimension (measure_id INTEGER, dimension_id INTEGER, role TEXT, default_member_id INTEGER);
		CREATE TABLE quantity (id INTEGER PRIMARY KEY, measure_id INTEGER, release_id INTEGER, key TEXT);
		INSERT INTO dimension VALUES (1, 'age');
		INSERT INTO measure_dimension VALUES (1, 1, 'breakdown', NULL);
		INSERT INTO quantity VALUES (1, 1, 2, 'population/localAuthority:2026-05-uk-bgc');
		CREATE TABLE fixture_change (quantity TEXT, area_code TEXT, from_period TEXT, to_period TEXT, from_period_id INTEGER, span TEXT, from_value REAL, to_value REAL, change REAL, percent_change REAL, from_accuracy TEXT, to_accuracy TEXT, accuracy TEXT, boundary_check TEXT, published_change REAL, boundary_effect REAL, materially_changed INTEGER, residents_lost REAL, residents_gained REAL, land_lost REAL, land_gained REAL, from_dataset TEXT, to_dataset TEXT, source_changed INTEGER, period_kind_changed INTEGER, periods_overlap INTEGER, breaks TEXT, break_notes TEXT);
		INSERT INTO fixture_change VALUES
			('population/localAuthority:2026-05-uk-bgc', 'E06000001', '2022', '2024', 1, 'first-latest', 92000, 93000, 1000, 1.0869565217391304, 'regrouped', 'published', 'regrouped', 'published', 1200, 200, 0, 0.01, 0.002, 0.001, 0, 'population-uk', 'population-uk', 0, 0, 0, NULL, NULL),
			('population/localAuthority:2026-05-uk-bgc', 'E06000001', '2022', '2023', 1, 'adjacent', 92000, 92500, 500, 0.5434782608695652, 'regrouped', 'regrouped', 'regrouped', 'code-not-published', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'population-uk', 'population-uk', 0, 0, 0, 'census 2023', 'A note.');
		CREATE VIEW v_area_period_change AS SELECT * FROM fixture_change;
	`);
	atlas.close();
}

test("adds the change on fixed boundaries, adjacent pairs first", () => {
	const body = data(
		get(`/v1/data/population/series?place=E06000001&${on}`, {
			databasePath: changesPath,
			readPath,
		}),
	);
	const changes = body.changes as {
		quantity: string;
		pairs: Array<Record<string, unknown>>;
	};
	assert.equal(changes.quantity, "population/localAuthority:2026-05-uk-bgc");
	assert.deepEqual(
		changes.pairs.map((pair) => [pair.from, pair.to, pair.span]),
		[
			["2022", "2023", "adjacent"],
			["2022", "2024", "first-latest"],
		],
	);
	assert.deepEqual(changes.pairs[0]!.breaks, "census 2023");
	assert.equal(changes.pairs[0]!.boundaryEffect, null);
	assert.equal(changes.pairs[0]!.materiallyChanged, null);
	assert.deepEqual(changes.pairs[1], {
		from: "2022",
		to: "2024",
		span: "first-latest",
		fromValue: 92000,
		toValue: 93000,
		change: 1000,
		percentChange: 1.0869565217391304,
		fromAccuracy: "regrouped",
		toAccuracy: "published",
		accuracy: "regrouped",
		boundaryCheck: "published",
		publishedChange: 1200,
		boundaryEffect: 200,
		materiallyChanged: false,
		residentsLost: 0.01,
		residentsGained: 0.002,
		landLost: 0.001,
		landGained: 0,
		fromDataset: "population-uk",
		toDataset: "population-uk",
		sourceChanged: false,
		periodKindChanged: false,
		periodsOverlap: false,
		breaks: null,
		breakNotes: null,
	});
});

test("leaves changes out of an atlas built without them", () => {
	const body = data(get(`/v1/data/population/series?place=E06000001&${on}`));
	assert.equal(body.changes, undefined);
});

test("reads no change for a part of a total, a ratio or an unknown quantity", () => {
	const atlas = new DatabaseSync(changesPath, { readOnly: true });
	const target = { geography: "localAuthority", release: "2026-05-uk-bgc" };
	const part = {
		datasetId: "population-uk",
		measure: "population",
		dimensions: {},
		geography: "localAuthority",
	};
	try {
		// Summing the age parts reads the total.
		assert.equal(
			readAreaPeriodChanges(
				atlas,
				{ parts: [{ ...part, sum: ["age"] }] },
				target,
				"E06000001",
			)?.changes.length,
			2,
		);
		assert.equal(
			readAreaPeriodChanges(
				atlas,
				{ parts: [{ ...part, dimensions: { age: "0" } }] },
				target,
				"E06000001",
			),
			undefined,
		);
		assert.equal(
			readAreaPeriodChanges(
				atlas,
				{ parts: [part], ratio: { parts: [part], scale: 100 } },
				target,
				"E06000001",
			),
			undefined,
		);
		assert.equal(
			readAreaPeriodChanges(
				atlas,
				{ parts: [part] },
				{ geography: "localAuthority", release: "2023-12-uk-bgc" },
				"E06000001",
			),
			undefined,
		);
	} finally {
		atlas.close();
	}
});
