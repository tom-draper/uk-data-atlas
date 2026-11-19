import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
	convertedReleases,
	readReleaseSeries,
	type ReleaseSeriesSpec,
} from "@uk-data-atlas/measures";

/**
 * Two wards on the 2026 release. W1 existed in 2019 and 2015; W2 was made
 * since, so its 2019 values were split from its predecessors' areas.
 * People and households are published on 2026 for 2026, on 2019 for 2019
 * and 2026 (the 2026 period stays native), and on 2015 with no route.
 * Median age is published on 2019 alone and is refused.
 */
const atlas = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE area_releases (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
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

		INSERT INTO dataset VALUES (1, 'census');
		INSERT INTO measure VALUES (1, 'people'), (2, 'households'), (3, 'median-age');
		INSERT INTO area_releases VALUES (1, 'ward', '2019-12-uk-bgc'), (2, 'ward', '2026-05-uk-bgc'), (3, 'ward', '2015-12-uk-bgc');
		INSERT INTO status VALUES (1, 'observed'), (2, 'estimated'), (6, 'derived');
		INSERT INTO period VALUES (1, '2015', '2015-01-01'), (2, '2019', '2019-01-01'), (3, '2026', '2026-01-01');
		INSERT INTO area VALUES (1, 'W1'), (2, 'W2'), (3, 'W0');
		INSERT INTO area_version VALUES
			(11, 1, 1, 'Ward one'), (12, 1, 2, 'Ward one'), (13, 1, 3, 'Ward one'),
			(22, 2, 2, 'Ward two'), (31, 3, 1, 'Old ward');
		INSERT INTO crosswalk VALUES (1, 'ward-2019-to-2026');
		INSERT INTO series VALUES
			(1, 1, 1, 2, 'published', 'people@2026'),
			(2, 1, 1, 1, 'published', 'people@2019'),
			(3, 1, 1, 3, 'published', 'people@2015'),
			(4, 1, 2, 2, 'published', 'households@2026'),
			(5, 1, 2, 1, 'published', 'households@2019'),
			(6, 1, 3, 1, 'published', 'median@2019'),
			(10, 1, 1, 2, 'converted', 'people@2019~converted:ward:2026-05-uk-bgc'),
			(11, 1, 2, 2, 'converted', 'households@2019~converted:ward:2026-05-uk-bgc');
		INSERT INTO observation VALUES
			(1, 12, 3, 100, 1, NULL, NULL), (1, 22, 3, 50, 1, NULL, NULL),
			(2, 11, 2, 90, 1, NULL, NULL), (2, 31, 2, 40, 1, NULL, NULL),
			(2, 11, 3, 99, 1, NULL, NULL),
			(3, 13, 1, 80, 1, NULL, NULL),
			(4, 12, 3, 50, 1, NULL, NULL), (4, 22, 3, 25, 1, NULL, NULL),
			(5, 11, 2, 45, 1, NULL, NULL), (5, 31, 2, 20, 1, NULL, NULL),
			(6, 11, 2, 41, 1, NULL, NULL),
			(10, 12, 2, 90, 6, NULL, NULL), (10, 22, 2, 40, 2, 30, 50),
			(11, 12, 2, 45, 6, NULL, NULL), (11, 22, 2, 20, 2, NULL, NULL);
		INSERT INTO series_estimate VALUES (10, 22, 2, 0.5), (11, 22, 2, 1);
		INSERT INTO series_input VALUES (10, 2, 'value'), (11, 5, 'value');
		INSERT INTO series_conversion VALUES
			(10, 'sum', 'population', 0, 0.7, 1, NULL),
			(11, 'sum', 'population', 0, 0.7, 0.5, NULL);
		INSERT INTO series_crosswalk VALUES (10, 0, 1, 0), (11, 0, 1, 0);
		INSERT INTO measure_conversion VALUES (1, 'sum', 'population', 'A count.'), (3, 'refuse', NULL, 'A median cannot be added.');
		INSERT INTO conversion_skip VALUES
			(1, 1, 3, 2, 'no-route', 1),
			(1, 3, 1, 2, 'refused-measure', 1);
	`);
	return database;
};

const part = (measure: string) => ({
	datasetId: "census",
	measure,
	dimensions: {},
	geography: "ward",
});
const target = { geography: "ward", release: "2026-05-uk-bgc" };
const people: ReleaseSeriesSpec = { parts: [part("people")] };
const perHousehold: ReleaseSeriesSpec = {
	parts: [part("people")],
	ratio: { parts: [part("households")], scale: 1 },
};
const read = (spec: ReleaseSeriesSpec, code: string) =>
	readReleaseSeries(atlas(), spec, target, code)!;

describe("a measure's series rebuilt on one boundary release", () => {
	it("lists the releases that hold converted series", () => {
		expect(convertedReleases(atlas())).toEqual([target]);
	});

	it("returns a period published on the target natively, unchanged", () => {
		const series = read(people, "W1");
		const native = series.values.find((v) => v.period === "2026")!;
		expect(native).toEqual({
			periodId: 3,
			period: "2026",
			value: 100,
			status: "observed",
			method: "native",
			exactShare: 1,
			flags: [],
		});
		// The 2019 release's own 2026 value (99) is not used.
		expect(series.values.filter((v) => v.period === "2026")).toHaveLength(1);
	});

	it("names the source of a value regrouped exactly", () => {
		const exact = read(people, "W1").values.find((v) => v.period === "2019")!;
		expect(exact).toMatchObject({
			value: 90,
			status: "derived",
			method: "exact",
			exactShare: 1,
			source: {
				release: "ward:2019-12-uk-bgc",
				rule: "sum",
				basis: "population",
				crosswalks: ["ward-2019-to-2026"],
				seriesCoverage: 1,
			},
			flags: [],
		});
	});

	it("flags a weighted count's split share and a ward made since", () => {
		const weighted = read(people, "W2").values.find((v) => v.period === "2019")!;
		expect(weighted).toMatchObject({
			value: 40,
			status: "estimated",
			lower: 30,
			upper: 50,
			method: "weighted",
			exactShare: 0.5,
			flags: ["area-not-on-source-release", "low-exact-share"],
		});
	});

	it("says a period with no crosswalk has no route", () => {
		expect(read(people, "W1").gaps).toEqual([
			{
				periodId: 1,
				period: "2015",
				sources: [{ release: "ward:2015-12-uk-bgc", reason: "no-route" }],
			},
		]);
	});

	it("rebuilds a rate from its converted numerator and denominator", () => {
		const rate = read(perHousehold, "W1").values.find((v) => v.period === "2019")!;
		expect(rate).toMatchObject({
			value: 2,
			method: "exact",
			status: "derived",
			rebuiltRatio: true,
			// The households series reaches only half its areas.
			flags: ["low-series-coverage"],
		});
		expect(rate.source?.seriesCoverage).toBe(0.5);
	});

	it("keeps a rate of native parts native", () => {
		const rate = read(perHousehold, "W1").values.find((v) => v.period === "2026")!;
		expect(rate).toMatchObject({ value: 2, method: "native", status: "observed" });
		expect(rate.rebuiltRatio).toBeUndefined();
	});

	it("refuses a rate whose parts were split by a weight", () => {
		const series = read(perHousehold, "W2");
		expect(series.values.map((v) => v.period)).toEqual(["2026"]);
		expect(series.gaps.find((gap) => gap.period === "2019")).toEqual({
			periodId: 2,
			period: "2019",
			sources: [{ release: "ward:2026-05-uk-bgc", reason: "split-ratio" }],
		});
	});

	it("refuses a median, with the measure's reason", () => {
		const series = read({ parts: [part("median-age")] }, "W1");
		expect(series.values).toEqual([]);
		expect(series.gaps[0]!.sources).toEqual([
			{
				release: "ward:2019-12-uk-bgc",
				reason: "refused-measure",
				note: "A median cannot be added.",
			},
		]);
		expect(series.conversion).toEqual({
			rule: "refuse",
			reason: "A median cannot be added.",
		});
	});

	it("is undefined for an area or release that does not exist", () => {
		expect(readReleaseSeries(atlas(), people, target, "W0")).toBeUndefined();
		expect(
			readReleaseSeries(atlas(), people, { geography: "ward", release: "1999" }, "W1"),
		).toBeUndefined();
	});
});
