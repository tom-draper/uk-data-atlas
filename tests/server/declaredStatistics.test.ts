import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { statisticsTables } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	declaredStatistics,
	periods,
	type DeclaredDataset,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { rebuildFromLayout } from "@uk-data-atlas/atlas-runtime/catalogue";
import { measure } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	writeSqliteTables,
	type SqliteTable,
} from "@uk-data-atlas/atlas-runtime/storage";

const areas = (): Record<string, SqliteTable> => ({
	area_releases: {
		columns: [
			"position INTEGER UNIQUE",
			"geography TEXT",
			"id TEXT",
			"status TEXT",
		],
		key: ["geography", "id"],
		rows: [
			[0, "localAuthority", "2024-05-uk-bgc", "available"],
			[1, "localAuthority", "2022-12-uk-bgc-v2", "available"],
			[2, "region", "2025-12-en-bgc", "available"],
		],
	},
	geography: {
		rowid: true,
		columns: ["id INTEGER", "slug TEXT"],
		key: ["id"],
		rows: [
			[1, "localAuthority"],
			[2, "region"],
		],
	},
	area: {
		rowid: true,
		columns: [
			"id INTEGER",
			"geography_id INTEGER REFERENCES geography(id)",
			"code TEXT",
		],
		key: ["id"],
		rows: [
			[1, 1, "E06000001"],
			[2, 1, "E06000002"],
			[3, 1, "E07000026"],
			[4, 2, "E12000001"],
		],
	},
	area_version: {
		rowid: true,
		columns: [
			"id INTEGER",
			"area_id INTEGER REFERENCES area(id)",
			"release_id INTEGER REFERENCES area_releases(position)",
			"name TEXT",
		],
		key: ["id"],
		rows: [
			[1, 1, 0, "Hartlepool"],
			[2, 2, 0, "Middlesbrough"],
			[3, 3, 1, "Allerdale"],
			[4, 4, 2, "North East"],
		],
	},
});

const entry = {
	output: "example",
	fingerprint: "sha256:fixture",
	source: {
		name: "Example",
		description: "An example dataset.",
		source: "Office for National Statistics",
		licence: "Open Government Licence v3.0",
	},
};

const file = (data: Record<string, object>, header: object = {}) =>
	JSON.stringify({
		2024: {
			id: "example2024",
			type: "example",
			year: 2024,
			boundaryType: "localAuthority",
			boundaryYear: 2024,
			...header,
			data,
		},
	});

const write = (config: DeclaredDataset, text: string) => {
	const database = new DatabaseSync(":memory:");
	database.exec("PRAGMA foreign_keys = ON");
	writeSqliteTables(database, {
		...areas(),
		...statisticsTables([declaredStatistics(config, () => text, entry)]),
	});
	return database;
};

const CRIMES = measure(
	"crimes",
	"Crimes",
	"offences",
	"count",
	"sum",
	"Recorded offences.",
);
const RATE = measure(
	"rate",
	"Rate",
	"percent",
	"rate",
	"none",
	"A modelled rate.",
);

describe("declared statistics", () => {
	it("maps fields, members, periods, intervals and releases from configuration", () => {
		const config: DeclaredDataset = {
			type: "example",
			name: "name",
			alsoIn: [
				{ geography: "localAuthority", year: 2022 },
				{ geography: "region", year: 2025 },
			],
			exclude: [{ codes: /^E13/, reason: "Not an atlas geography." }],
			measures: [CRIMES, RATE],
			dimensions: [
				{
					slug: "offence",
					label: "Offence",
					members: [
						{ key: "total", code: "all", label: "All offences" },
						{ key: "theft", label: "Theft", parent: "total" },
					],
				},
			],
			fields: [
				{ path: "{offence}", measure: "crimes" },
				{
					path: "rates.{period}.value",
					lower: "rates.{period}.lower",
					upper: "rates.{period}.upper",
					measure: "rate",
					period: (key) => periods.financialYear(Number(key)),
				},
			],
			derived: { perHead: "Computed from crimes and population." },
		};
		const database = write(
			config,
			file({
				E06000001: {
					name: "Hartlepool",
					total: 10,
					theft: 4,
					perHead: 0.1,
					rates: { 2003: { value: 5, lower: 4, upper: 6 } },
				},
				E07000026: { name: "Allerdale", total: 3, theft: null },
				E12000001: { name: "North East region", total: 50, theft: 20 },
				E13000001: { name: "Inner London", total: 99 },
			}),
		);
		const rows = database
			.prepare(
				"SELECT measure, members, area_code, area_name, release, period, value, lower, upper FROM v_observation ORDER BY area_code, measure, members",
			)
			.all()
			.map((row) => ({ ...row }));
		expect(rows).toEqual([
			{
				measure: "crimes",
				members: "offence=all",
				area_code: "E06000001",
				area_name: "Hartlepool",
				release: "2024-05-uk-bgc",
				period: "2024",
				value: 10,
				lower: null,
				upper: null,
			},
			{
				measure: "crimes",
				members: "offence=theft",
				area_code: "E06000001",
				area_name: "Hartlepool",
				release: "2024-05-uk-bgc",
				period: "2024",
				value: 4,
				lower: null,
				upper: null,
			},
			{
				measure: "rate",
				members: null,
				area_code: "E06000001",
				area_name: "Hartlepool",
				release: "2024-05-uk-bgc",
				period: "2003-04",
				value: 5,
				lower: 4,
				upper: 6,
			},
			{
				measure: "crimes",
				members: "offence=all",
				area_code: "E07000026",
				area_name: "Allerdale",
				release: "2022-12-uk-bgc-v2",
				period: "2024",
				value: 3,
				lower: null,
				upper: null,
			},
			{
				measure: "crimes",
				members: "offence=all",
				area_code: "E12000001",
				area_name: "North East region",
				release: "2025-12-en-bgc",
				period: "2024",
				value: 50,
				lower: null,
				upper: null,
			},
			{
				measure: "crimes",
				members: "offence=theft",
				area_code: "E12000001",
				area_name: "North East region",
				release: "2025-12-en-bgc",
				period: "2024",
				value: 20,
				lower: null,
				upper: null,
			},
		]);
		expect(
			database
				.prepare(
					"SELECT c.code, p.code AS parent FROM dimension_member c LEFT JOIN dimension_member p ON p.id = c.parent_id ORDER BY c.position",
				)
				.all()
				.map((row) => ({ ...row })),
		).toEqual([
			{ code: "all", parent: null },
			{ code: "theft", parent: "all" },
		]);
		expect(
			database
				.prepare("SELECT count(*) AS n FROM dataset_area_name")
				.get(),
		).toEqual({ n: 1 });
		expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
	});

	it("discovers nested members and gives them parents", () => {
		const database = write(
			{
				type: "example",
				measures: [CRIMES],
				dimensions: [{ slug: "group", label: "Group" }],
				fields: [{ path: "{group}.{group}.count", measure: "crimes" }],
			},
			file({
				E06000001: {
					White: { Irish: { count: 1, code: "2" } },
					"Other ethnic group": { Arab: { count: 2, code: "18" } },
				},
			}),
		);
		expect(
			database
				.prepare(
					"SELECT c.code, c.label, p.code AS parent FROM dimension_member c LEFT JOIN dimension_member p ON p.id = c.parent_id ORDER BY c.position",
				)
				.all()
				.map((row) => ({ ...row })),
		).toEqual([
			{ code: "white", label: "White", parent: null },
			{ code: "irish", label: "Irish", parent: "white" },
			{
				code: "other-ethnic-group",
				label: "Other ethnic group",
				parent: null,
			},
			{ code: "arab", label: "Arab", parent: "other-ethnic-group" },
		]);
	});

	it("marks values a status function flags", () => {
		const database = write(
			{
				type: "example",
				measures: [RATE],
				fields: [
					{
						path: "value",
						measure: "rate",
						status: (record) =>
							record.known === true ? undefined : "estimated",
					},
				],
			},
			file({
				E06000001: { value: 1, known: true },
				E06000002: { value: 2, known: false },
			}),
		);
		expect(
			database
				.prepare(
					"SELECT area_code, status FROM v_observation ORDER BY area_code",
				)
				.all()
				.map((row) => ({ ...row })),
		).toEqual([
			{ area_code: "E06000001", status: "observed" },
			{ area_code: "E06000002", status: "estimated" },
		]);
	});

	it("refuses numbers no field claims", () => {
		expect(() =>
			write(
				{
					type: "example",
					measures: [CRIMES],
					fields: [{ path: "total", measure: "crimes" }],
				},
				file({ E06000001: { total: 1, extra: 2 } }),
			),
		).toThrow(
			"example 2024: extra in E06000001 is not mapped or declared derived",
		);
	});

	it("refuses codes in no listed release", () => {
		expect(() =>
			write(
				{
					type: "example",
					measures: [CRIMES],
					fields: [{ path: "total", measure: "crimes" }],
				},
				file({ E07000026: { total: 1 } }),
			),
		).toThrow("example 2024: area E07000026 is in no listed release");
	});

	it("refuses keys that are not declared members", () => {
		expect(() =>
			write(
				{
					type: "example",
					measures: [CRIMES],
					dimensions: [
						{
							slug: "offence",
							label: "Offence",
							members: [{ key: "total" }],
						},
					],
					fields: [{ path: "{offence}", measure: "crimes" }],
				},
				file({ E06000001: { total: 1, theft: 2 } }),
			),
		).toThrow("theft in E06000001 is not mapped or declared derived");
	});

	it("labels periods so one label always means the same dates", () => {
		expect(periods.financialYear(1999)).toEqual({
			label: "1999-00",
			kind: "financial_year",
			start: "1999-04-01",
			end: "2000-03-31",
		});
		expect(periods.academicYear(2024).label).toBe("2024/25");
		expect(periods.quarter(2026, 1).end).toBe("2026-03-31");
		expect(periods.month(2024, 2).end).toBe("2024-02-29");
		expect(periods.yearEnding(2026, 3)).toMatchObject({
			start: "2025-04-01",
			end: "2026-03-31",
		});
		expect(periods.census(2021)).toMatchObject({
			label: "2021-census",
			start: "2021-03-21",
		});
	});

	describe("served from rows", () => {
		const config: DeclaredDataset = {
			type: "example",
			name: "name",
			alsoIn: [{ geography: "localAuthority", year: 2022 }],
			measures: [CRIMES, RATE],
			dimensions: [
				{
					slug: "offence",
					label: "Offence",
					members: [
						{ key: "total", code: "all" },
						{ key: "theft", parent: "total" },
					],
				},
			],
			fields: [
				{ path: "counts.{offence}", measure: "crimes" },
				{
					path: "rate.value",
					lower: "rate.lower",
					upper: "rate.upper",
					measure: "rate",
				},
			],
			derived: {
				share: "Theft as a percentage of all offences.",
				"counts.other": "All offences less theft.",
			},
			rebuild: {
				derived: {
					"counts.other": (record) => {
						const counts = record.counts as Record<string, number>;
						return counts.total - counts.theft;
					},
					share: (record) => {
						const counts = record.counts as Record<string, number>;
						return (counts.theft / counts.total) * 100;
					},
				},
			},
		};
		const record = (code: string, name: string, total: number) => ({
			code,
			name,
			kind: "district",
			share: (3 / total) * 100,
			counts: { total, theft: 3, other: total - 3 },
			rate: { value: 1.5, lower: 1.25, upper: 2 },
		});
		const text = JSON.stringify({
			2023: {
				id: "example2023",
				year: 2023,
				boundaryType: "localAuthority",
				boundaryYear: 2024,
				data: {
					E06000001: record("E06000001", "Hartlepool", 7),
					E07000026: record("E07000026", "Allerdale (old)", 9),
				},
				notes: { source: "Example" },
			},
			2024: {
				id: "example2024",
				year: 2024,
				boundaryType: "localAuthority",
				boundaryYear: 2024,
				data: {
					E06000002: record("E06000002", "Middlesbrough", 11),
				},
				notes: { source: "Example" },
			},
		});

		it("rebuilds the compiled JSON byte for byte from rows and layout", () => {
			const database = write(config, text);
			expect(
				rebuildFromLayout(database, "example", config.rebuild!.derived),
			).toBe(text);
			expect(
				database
					.prepare(
						"SELECT position, key, header FROM dataset_part ORDER BY position",
					)
					.all()
					.map((row) => ({ ...row })),
			).toEqual([
				{
					position: 0,
					key: "2023",
					header: '{"id":"example2023","year":2023,"boundaryType":"localAuthority","boundaryYear":2024,"data":null,"notes":{"source":"Example"}}',
				},
				{
					position: 1,
					key: "2024",
					header: '{"id":"example2024","year":2024,"boundaryType":"localAuthority","boundaryYear":2024,"data":null,"notes":{"source":"Example"}}',
				},
			]);
			expect(
				database
					.prepare(
						"SELECT path, kind, rule, literal FROM dataset_leaf WHERE part = 0 ORDER BY position",
					)
					.all()
					.map((row) => Object.values(row)),
			).toEqual([
				['["code"]', "code", null, null],
				['["name"]', "name", null, null],
				['["kind"]', "literal", null, '"district"'],
				['["share"]', "derived", "share", null],
				['["counts","total"]', "value", null, null],
				['["counts","theft"]', "value", null, null],
				['["counts","other"]', "derived", "counts.other", null],
				['["rate","value"]', "value", null, null],
				['["rate","lower"]', "lower", null, null],
				['["rate","upper"]', "upper", null, null],
			]);
			expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual(
				[],
			);
		});

		it("keeps the file's record order", () => {
			const unsorted = text.replace(
				/"E06000001":(\{.*?\}\}),"E07000026":(\{.*?\}\})/,
				'"E07000026":$2,"E06000001":$1',
			);
			expect(unsorted).not.toBe(text);
			const database = write(config, unsorted);
			expect(
				rebuildFromLayout(database, "example", config.rebuild!.derived),
			).toBe(unsorted);
		});

		it("refuses rows that do not rebuild the compiled JSON", () => {
			const second = text.indexOf(
				'"district"',
				text.indexOf('"E07000026"'),
			);
			const changed = `${text.slice(0, second)}"unitary"${text.slice(second + '"district"'.length)}`;
			expect(() => write(config, changed)).toThrow(
				/example: rows do not rebuild the compiled JSON byte for byte\. At \d+, compiled .*unitary.*, rebuilt .*district/,
			);
		});

		it("refuses a derived number without a rebuild rule", () => {
			expect(() =>
				write(
					{
						...config,
						rebuild: {
							derived: { share: config.rebuild!.derived!.share },
						},
					},
					text,
				),
			).toThrow("example: derived counts.other has no rebuild rule");
		});
	});
});
