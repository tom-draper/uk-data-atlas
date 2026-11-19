import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "vitest";
import type { MeasurePreference } from "@uk-data-atlas/measures";
import {
	deriveDimensionRoles,
	rankSeries,
	writeDefaultObservation,
	type DimensionRole,
	type MemberFact,
	type SeriesFact,
} from "../../src/storage/defaultObservation.ts";

const measures = new Map([
	[1, "households"],
	[2, "life-expectancy"],
	[3, "claimants"],
]);
const dimensions = new Map([
	[1, "tenure"],
	[2, "sex"],
	[3, "age-group"],
]);
const members = new Map<number, MemberFact>([
	[1, { dimensionId: 1, code: "total", parentId: null }],
	[2, { dimensionId: 1, code: "owned", parentId: 1 }],
	[3, { dimensionId: 2, code: "female", parentId: null }],
	[4, { dimensionId: 2, code: "male", parentId: null }],
	[5, { dimensionId: 3, code: "16-plus", parentId: null }],
	[6, { dimensionId: 3, code: "16-24", parentId: 5 }],
]);

const held = (measureId: number, ...pairs: Array<[number, number]>) => ({
	measureId,
	members: new Map(pairs),
});

describe("deriveDimensionRoles", () => {
	test("a root member coded total makes a dimension a breakdown with that default", () => {
		const { roles, problems } = deriveDimensionRoles({
			series: [held(1, [1, 1]), held(1, [1, 2])],
			measures,
			dimensions,
			members,
			preferences: {},
		});
		assert.deepEqual(problems, []);
		assert.deepEqual(roles, [
			{
				measureId: 1,
				dimensionId: 1,
				role: "breakdown",
				defaultMemberId: 1,
			},
		]);
	});

	test("the total has to be held by the measure's own series", () => {
		const { problems } = deriveDimensionRoles({
			series: [held(1, [1, 2])],
			measures,
			dimensions,
			members,
			preferences: {},
		});
		assert.match(
			problems.join(),
			/households\/tenure: no series holds a total/,
		);
	});

	test("a dimension with no total and no declaration is a problem, not a guess", () => {
		const { roles, problems } = deriveDimensionRoles({
			series: [held(2, [2, 3]), held(2, [2, 4])],
			measures,
			dimensions,
			members,
			preferences: {},
		});
		assert.deepEqual(roles, []);
		assert.match(problems.join(), /life-expectancy\/sex/);
	});

	test("a declared role wins, and differs per measure", () => {
		const preferences: Record<string, MeasurePreference> = {
			"life-expectancy": {
				dimensions: {
					sex: { role: "qualifier", reason: "two figures" },
				},
			},
			claimants: {
				dimensions: {
					"age-group": {
						role: "breakdown",
						default: "16-plus",
						reason: "16-plus holds 16-24",
					},
				},
			},
		};
		const { roles, problems } = deriveDimensionRoles({
			series: [held(2, [2, 3]), held(3, [3, 5]), held(3, [3, 6])],
			measures,
			dimensions,
			members,
			preferences,
		});
		assert.deepEqual(problems, []);
		assert.deepEqual(roles, [
			{
				measureId: 2,
				dimensionId: 2,
				role: "qualifier",
				defaultMemberId: null,
			},
			{
				measureId: 3,
				dimensionId: 3,
				role: "breakdown",
				defaultMemberId: 5,
			},
		]);
	});

	test("a declared default that is not a member is a problem", () => {
		const { problems } = deriveDimensionRoles({
			series: [held(3, [3, 6])],
			measures,
			dimensions,
			members,
			preferences: {
				claimants: {
					dimensions: {
						"age-group": {
							role: "breakdown",
							default: "all",
							reason: "x",
						},
					},
				},
			},
		});
		assert.match(
			problems.join(),
			/declared default member all does not exist/,
		);
	});
});

const releases = new Map([[1, "lsoa:2021"]]);
const series = (
	id: number,
	extra: Partial<SeriesFact> & { members?: Array<[number, number]> } = {},
): SeriesFact => ({
	id,
	key: `s${id}`,
	measureId: 1,
	releaseId: 1,
	dataset: "a",
	method: "published",
	shareAlike: false,
	...extra,
	members: new Map(extra.members ?? []),
});
const breakdownTenure: DimensionRole = {
	measureId: 1,
	dimensionId: 1,
	role: "breakdown",
	defaultMemberId: 1,
};
const rank = (
	list: SeriesFact[],
	options: {
		roles?: DimensionRole[];
		preferences?: Record<string, MeasurePreference>;
		overlaps?: (a: number, b: number) => boolean;
	} = {},
) =>
	rankSeries({
		series: list,
		roles: options.roles ?? [breakdownTenure],
		measures,
		dimensions,
		members,
		releases,
		overlaps: options.overlaps ?? (() => true),
		preferences: options.preferences ?? {},
	});

describe("rankSeries", () => {
	test("only series at the default of every breakdown are candidates", () => {
		const { quantities } = rank([
			series(1, { members: [[1, 1]] }),
			series(2, { members: [[1, 2]] }),
			series(3),
		]);
		assert.deepEqual(
			quantities.map(({ key, series }) => [
				key,
				series.map((entry) => entry.seriesId),
			]),
			[["households/lsoa:2021", [1, 3]]],
		);
	});

	test("published beats aggregated, modelled and converted", () => {
		const { quantities, problems } = rank([
			series(1, { method: "converted" }),
			series(2, { method: "modelled" }),
			series(3, { method: "aggregated" }),
			series(4, { method: "published" }),
		]);
		assert.deepEqual(problems, []);
		assert.deepEqual(
			quantities[0]!.series.map((entry) => entry.seriesId),
			[4, 3, 2, 1],
		);
	});

	test("an open modelled series beats a share-alike one", () => {
		const { quantities, problems } = rank([
			series(1, { method: "modelled", shareAlike: true }),
			series(2, { method: "modelled" }),
		]);
		assert.deepEqual(problems, []);
		assert.deepEqual(
			quantities[0]!.series.map((entry) => entry.seriesId),
			[2, 1],
		);
	});

	test("the declared dataset order breaks a tie between datasets", () => {
		const { quantities, problems } = rank(
			[series(1, { dataset: "b" }), series(2, { dataset: "a" })],
			{
				preferences: {
					households: {
						datasets: { order: ["b", "a"], reason: "x" },
					},
				},
			},
		);
		assert.deepEqual(problems, []);
		assert.deepEqual(
			quantities[0]!.series.map((entry) => entry.seriesId),
			[1, 2],
		);
	});

	test("a tie between series that hold the same area and period fails and names them", () => {
		const { problems } = rank([
			series(1, { dataset: "b" }),
			series(2, { dataset: "a" }),
		]);
		assert.equal(problems.length, 1);
		assert.match(
			problems[0]!,
			/Tie in quantity households\/lsoa:2021: s1 and s2/,
		);
	});

	test("a tie between series with nothing in common is ranked by id", () => {
		const { quantities, problems } = rank(
			[series(2, { dataset: "a" }), series(1, { dataset: "b" })],
			{ overlaps: () => false },
		);
		assert.deepEqual(problems, []);
		assert.deepEqual(quantities[0]!.series, [
			{ seriesId: 1, rank: 1 },
			{ seriesId: 2, rank: 2 },
		]);
	});

	test("each qualifier member is its own quantity", () => {
		const roles: DimensionRole[] = [
			{
				measureId: 2,
				dimensionId: 2,
				role: "qualifier",
				defaultMemberId: null,
			},
		];
		const { quantities, problems } = rank(
			[
				series(1, { measureId: 2, members: [[2, 3]] }),
				series(2, { measureId: 2, members: [[2, 4]] }),
			],
			{ roles },
		);
		assert.deepEqual(problems, []);
		assert.deepEqual(
			quantities.map(({ key }) => key),
			[
				"life-expectancy/lsoa:2021/sex=female",
				"life-expectancy/lsoa:2021/sex=male",
			],
		);
	});

	test("a series with a dimension that has no role is a problem", () => {
		const { problems } = rank([series(1, { members: [[1, 1]] })], {
			roles: [],
		});
		assert.match(
			problems.join(),
			/households\/tenure has no measure_dimension row/,
		);
	});
});

/** A small database in the shape the writer reads, with two datasets that both publish households. */
const fixture = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT, unit TEXT);
		CREATE TABLE dimension (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE dimension_member (id INTEGER PRIMARY KEY, dimension_id INTEGER, code TEXT, parent_id INTEGER);
		CREATE TABLE source (id INTEGER PRIMARY KEY, licence TEXT);
		CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT, source_id INTEGER);
		CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT, derived_from_id INTEGER, key TEXT);
		CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
		CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, name TEXT);
		CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT);
		CREATE TABLE status (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE dataset_area_name (dataset_id INTEGER, area_version_id INTEGER, name TEXT);
		CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, status_id INTEGER, lower REAL, upper REAL, category_id INTEGER, PRIMARY KEY (series_id, area_version_id, period_id));
		INSERT INTO measure VALUES (1, 'households', 'households');
		INSERT INTO dimension VALUES (1, 'tenure');
		INSERT INTO dimension_member VALUES (1, 1, 'total', NULL), (2, 1, 'owned', 1);
		INSERT INTO source VALUES (1, 'OGL');
		INSERT INTO dataset VALUES (1, 'primary', 1), (2, 'copy', 1);
		INSERT INTO area_release VALUES (1, 'lsoa', '2021');
		INSERT INTO area VALUES (1, 'E01'), (2, 'E02');
		INSERT INTO area_version VALUES (1, 1, 'One'), (2, 2, 'Two');
		INSERT INTO period VALUES (1, '2021');
		INSERT INTO status VALUES (1, 'observed');
		-- series 1: primary, total tenure. 2: copy, no tenure. 3: primary, owned only.
		INSERT INTO series VALUES (1, 1, 1, 1, 'published', NULL, 'primary/households'), (2, 2, 1, 1, 'published', NULL, 'copy/households'), (3, 1, 1, 1, 'published', NULL, 'primary/households/owned');
		INSERT INTO series_member VALUES (1, 1, 1), (3, 1, 2);
		-- primary lacks E02, and holds a NULL value for E01, which still counts as its answer.
		INSERT INTO observation VALUES (1, 1, 1, NULL, 1, NULL, NULL, NULL), (2, 1, 1, 9, 1, NULL, NULL, NULL), (2, 2, 1, 12, 1, NULL, NULL, NULL), (3, 1, 1, 4, 1, NULL, NULL, NULL);
	`);
	return database;
};

const preferences: Record<string, MeasurePreference> = {
	households: { datasets: { order: ["primary", "copy"], reason: "x" } },
};

describe("writeDefaultObservation", () => {
	test("falls through per observation, only on a missing row", () => {
		const database = fixture();
		const summary = writeDefaultObservation(database, preferences);
		assert.deepEqual(summary, {
			roles: 1,
			quantities: 1,
			rankedSeries: 2,
			contested: 1,
		});
		assert.deepEqual(
			database
				.prepare(
					"SELECT area_code, dataset, value, series_id, quantity, alternatives FROM v_observation_default ORDER BY area_code",
				)
				.all()
				.map((row) => ({ ...row })),
			[
				{
					area_code: "E01",
					dataset: "primary",
					value: null,
					series_id: 1,
					quantity: "households/lsoa:2021",
					alternatives: 1,
				},
				{
					area_code: "E02",
					dataset: "copy",
					value: 12,
					series_id: 2,
					quantity: "households/lsoa:2021",
					alternatives: 0,
				},
			],
		);
	});

	test("has the columns of v_observation first", () => {
		const database = fixture();
		writeDefaultObservation(database, preferences);
		database.exec(
			"CREATE VIEW v_observation AS SELECT d.slug AS dataset, m.slug AS measure, m.unit, NULL AS members, a.code AS area_code, v.name AS area_name, r.geography, r.release AS release, p.label AS period, o.value, o.lower, o.upper, NULL AS category, st.slug AS status, s.method, src.licence FROM observation o JOIN series s ON s.id = o.series_id JOIN dataset d ON d.id = s.dataset_id JOIN source src ON src.id = d.source_id JOIN measure m ON m.id = s.measure_id JOIN area_version v ON v.id = o.area_version_id JOIN area a ON a.id = v.area_id JOIN area_release r ON r.id = s.release_id JOIN period p ON p.id = o.period_id JOIN status st ON st.id = o.status_id",
		);
		const names = (view: string) =>
			(
				database.prepare(`PRAGMA table_info(${view})`).all() as Array<{
					name: string;
				}>
			).map((column) => column.name);
		assert.deepEqual(names("v_observation_default"), [
			...names("v_observation"),
			"series_id",
			"quantity",
			"alternatives",
		]);
	});

	test("fails on a tie between datasets that hold the same area and period", () => {
		const database = fixture();
		assert.throws(
			() => writeDefaultObservation(database, {}),
			/Tie in quantity households\/lsoa:2021: primary\/households and copy\/households/,
		);
	});

	test("fails when a dimension has no total and no declaration", () => {
		const database = fixture();
		database.exec("DELETE FROM dimension_member WHERE id = 1");
		assert.throws(
			() => writeDefaultObservation(database, preferences),
			/households\/tenure: no series holds a total/,
		);
	});
});
