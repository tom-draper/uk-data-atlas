import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
	declaredStatistics,
	directStatistics,
	measure,
	yearParts,
	type DeclaredDataset,
	type DirectPart,
	type StatisticsInput,
} from "@uk-data-atlas/measures";
import {
	statisticsTables,
	writeSqliteTables,
	type SqliteTable,
} from "../../pipeline/src/storage/index";

const areas = (): Record<string, SqliteTable> => ({
	area_release: {
		columns: [
			"id INTEGER UNIQUE",
			"geography TEXT",
			"release TEXT",
			"status TEXT",
		],
		key: ["geography", "release"],
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
			"release_id INTEGER REFERENCES area_release(id)",
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

const write = (input: StatisticsInput) => {
	const database = new DatabaseSync(":memory:");
	database.exec("CREATE TABLE payloads (id TEXT PRIMARY KEY, payload BLOB)");
	database.exec("PRAGMA foreign_keys = ON");
	writeSqliteTables(database, { ...areas(), ...statisticsTables([input]) });
	return database;
};

const config: DeclaredDataset = {
	type: "example",
	topic: "labour-market",
	name: "ladName",
	measures: [
		measure(
			"recorded-crimes",
			"Crimes",
			"offences",
			"count",
			"sum",
			"Offences.",
		),
	],
	dimensions: [
		{
			slug: "offence",
			label: "Offence",
			members: [
				{ key: "total", code: "all", label: "All offences" },
				{ key: "theft", label: "Theft" },
			],
		},
	],
	fields: [{ path: "{offence}", measure: "recorded-crimes" }],
	exclude: [{ codes: /^E07/, reason: "Districts are not in this release." }],
	payload: {
		parts: yearParts("example", "localAuthority", 2024),
		code: "ladCode",
	},
};

const parts = (...records: DirectPart["records"]): DirectPart[] => [
	{ key: "2024", records },
];
const value = (offence: string, number: number | null) => ({
	measure: "recorded-crimes",
	members: { offence },
	value: number,
});
const rows = (database: DatabaseSync) =>
	database
		.prepare(
			"SELECT measure, members, area_code, area_name, period, value, status FROM v_observation ORDER BY members, area_code",
		)
		.all()
		.map((row) => ({ ...row }));

describe("directStatistics", () => {
	const record = (
		code: string,
		name: string,
		total: number,
		theft: number,
	) => ({
		code,
		name,
		values: [value("total", total), value("theft", theft)],
	});

	it("stores the rows the compiled JSON of the same data stores", () => {
		const data = {
			E06000001: {
				ladCode: "E06000001",
				ladName: "Hartlepool",
				total: 10,
				theft: 4,
			},
			E06000002: {
				ladCode: "E06000002",
				ladName: "Middlesbrough",
				total: 3,
				theft: 1,
			},
		};
		const json = JSON.stringify({
			2024: {
				id: "example2024",
				type: "example",
				year: 2024,
				boundaryType: "localAuthority",
				boundaryYear: 2024,
				data,
			},
		});
		const compiled = write(declaredStatistics(config, () => json, entry));
		const direct = write(
			directStatistics(
				config,
				parts(
					record("E06000001", "Hartlepool", 10, 4),
					record("E06000002", "Middlesbrough", 3, 1),
				),
				entry,
			),
		);
		try {
			expect(rows(direct)).toEqual(rows(compiled));
			expect(rows(direct)).toHaveLength(4);
		} finally {
			compiled.close();
			direct.close();
		}
	});

	it("skips an area the declaration excludes and stores no null value", () => {
		const database = write(
			directStatistics(
				config,
				parts(record("E07000026", "Allerdale", 1, 1), {
					code: "E06000001",
					name: "Hartlepool",
					values: [value("total", 10), value("theft", null)],
				}),
				entry,
			),
		);
		try {
			expect(rows(database).map((row) => row.area_code)).toEqual([
				"E06000001",
			]);
		} finally {
			database.close();
		}
	});

	it("rejects what the declaration does not describe", () => {
		const build = (...records: DirectPart["records"]) =>
			write(directStatistics(config, parts(...records), entry));
		expect(() =>
			build({
				code: "E06000001",
				values: [{ measure: "rate", members: {}, value: 1 }],
			}),
		).toThrow(/rate is not a declared measure/);
		expect(() =>
			build({ code: "E06000001", values: [value("arson", 1)] }),
		).toThrow(/arson is not a declared offence/);
		expect(() =>
			build({
				code: "E06000001",
				values: [{ measure: "recorded-crimes", value: 1 }],
			}),
		).toThrow(/fits none of the declared fields/);
		expect(() => build({ code: "E99999999", values: [] })).toThrow(
			/E99999999 is in no listed release/,
		);
	});

	it("stores external keys and header relationships like compiled records", () => {
		const keyed: DeclaredDataset = {
			...config,
			keys: { ODS1: "E06000001" },
			keyScheme: "nhs-ods",
			headerRelationships: [
				{
					field: "mapping",
					child: { geography: "region", year: 2025 },
					parent: { geography: "localAuthority", year: 2024 },
				},
			],
		};
		const compiled = write(
			declaredStatistics(
				keyed,
				() =>
					file(
						{
							ODS1: {
								ladCode: "ODS1",
								ladName: "Hartlepool",
								total: 10,
								theft: 4,
							},
						},
						{ mapping: { E12000001: "ODS1" } },
					),
				entry,
			),
		);
		const direct = write(
			directStatistics(
				keyed,
				[
					{
						key: "2024",
						records: [record("ODS1", "Hartlepool", 10, 4)],
						relationships: { mapping: { E12000001: "ODS1" } },
					},
				],
				entry,
			),
		);
		try {
			expect(rows(direct)).toEqual(rows(compiled));
			for (const table of [
				"dataset_area_key",
				"area_identifier",
				"area_relationship",
			])
				expect(direct.prepare(`SELECT * FROM ${table}`).all()).toEqual(
					compiled.prepare(`SELECT * FROM ${table}`).all(),
				);
			expect(
				direct.prepare("SELECT key FROM dataset_area_key").get()?.key,
			).toBe("ODS1");
			expect(
				direct
					.prepare("SELECT scheme, identifier FROM area_identifier")
					.all(),
			).toEqual([{ scheme: "nhs-ods", identifier: "ODS1" }]);
			expect(
				direct
					.prepare("SELECT count(*) AS n FROM area_relationship")
					.get()?.n,
			).toBe(1);
		} finally {
			compiled.close();
			direct.close();
		}
	});

	it("stores record-level parent relationships and names", () => {
		const withParent: DeclaredDataset = {
			...config,
			parents: [
				{
					code: "regionCode",
					name: "regionName",
					release: { geography: "region", year: 2025 },
				},
			],
		};
		const compiled = write(
			declaredStatistics(
				withParent,
				() =>
					file({
						E06000001: {
							ladCode: "E06000001",
							ladName: "Hartlepool",
							total: 10,
							theft: 4,
							regionCode: "E12000001",
							regionName: "North East",
						},
					}),
				entry,
			),
		);
		const direct = write(
			directStatistics(
				withParent,
				parts({
					...record("E06000001", "Hartlepool", 10, 4),
					parents: {
						regionCode: { code: "E12000001", name: "North East" },
					},
				}),
				entry,
			),
		);
		try {
			expect(rows(direct)).toEqual(rows(compiled));
			expect(
				direct.prepare("SELECT * FROM area_relationship").all(),
			).toEqual(
				compiled.prepare("SELECT * FROM area_relationship").all(),
			);
			expect(
				direct
					.prepare("SELECT count(*) AS n FROM area_relationship")
					.get()?.n,
			).toBe(1);
		} finally {
			compiled.close();
			direct.close();
		}
	});

	it("reads each contest's text from its record", () => {
		const input = directStatistics(
			{
				...config,
				election: {
					kind: "general",
					date: () => "2024-07-04",
				},
			},
			parts({
				code: "E06000001",
				name: "Hartlepool",
				contest: { area_name: "Hartlepool", winner: "LAB" },
				elected: { family_name: "Brown" },
				values: [value("theft", 3)],
			}),
			entry,
		);
		const database = write(input);
		try {
			expect(
				database
					.prepare(
						"SELECT area_code, area_name, winner, election, kind, polling_day FROM v_contest",
					)
					.all()
					.map((row) => ({ ...row })),
			).toEqual([
				{
					area_code: "E06000001",
					area_name: "Hartlepool",
					winner: "LAB",
					election: "2024",
					kind: "general",
					polling_day: "2024-07-04",
				},
			]);
			expect(
				database
					.prepare("SELECT family_name, elected FROM candidacy")
					.all()
					.map((row) => ({ ...row })),
			).toEqual([{ family_name: "Brown", elected: 1 }]);
		} finally {
			database.close();
		}
	});
});
