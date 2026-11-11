import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { statisticsTables } from "../../pipeline/src/storage/index";
import {
	periods,
	type DeclaredDataset,
	type DeclaredField,
} from "@uk-data-atlas/measures";
import { declaredStatistics } from "@uk-data-atlas/measures";
import { measure } from "@uk-data-atlas/measures";
import { yearParts } from "@uk-data-atlas/measures";
import { rebuildFromDeclaration } from "@uk-data-atlas/measures";
import { rebuildDatasetPayload } from "@uk-data-atlas/catalogue/node";
import { STATISTICS_DATASETS } from "@uk-data-atlas/measures";
import {
	writeSqliteTables,
	type SqliteTable,
} from "../../pipeline/src/storage/index";

const areas = (): Record<string, SqliteTable> => ({
	area_releases: {
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
			"release_id INTEGER REFERENCES area_releases(id)",
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
	database.exec("CREATE TABLE payloads (id TEXT PRIMARY KEY, payload BLOB)");
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
	it("generates a declared payload from rows alone", () => {
		const config: DeclaredDataset = {
			type: "example",
			module: "economy",
			name: "ladName",
			measures: [CRIMES, RATE],
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
			fields: [
				{
					path: "headline",
					measure: "crimes",
					members: { offence: "all" },
					wins: true,
				},
				{ path: "byOffence.{offence}", measure: "crimes" },
				{
					path: "rate",
					lower: "interval.lower",
					upper: "interval.upper",
					measure: "rate",
				},
			],
			payload: {
				parts: yearParts("example", "localAuthority", 2024),
				code: "ladCode",
			},
		};
		const record = (
			code: string,
			name: string,
			rest: Record<string, unknown>,
		) => ({ ladCode: code, ladName: name, ...rest });
		/** `headline` claims the all-offences series, so `byOffence` holds the rest. */
		const expected = JSON.parse(
			file({
				E06000001: record("E06000001", "Hartlepool", {
					headline: 10,
					byOffence: { theft: 4 },
					rate: 5,
					interval: { lower: 4, upper: 6 },
				}),
				E06000002: record("E06000002", "Middlesbrough", {
					headline: 3,
					byOffence: { theft: null },
					rate: null,
					interval: { lower: null, upper: null },
				}),
			}),
		);
		const database = write(config, JSON.stringify(expected));
		try {
			expect(
				JSON.parse(rebuildFromDeclaration(database, config, "example")),
			).toEqual(expected);
			// A series two fields fit needs exactly one to win.
			const ambiguous: DeclaredDataset = {
				...config,
				fields: (config.fields as DeclaredField[]).map(
					({ wins: _wins, ...field }) => field,
				),
			};
			expect(() =>
				rebuildFromDeclaration(database, ambiguous, "example"),
			).toThrow("mark exactly one `wins`");
			// A part with no rows fails unless it is declared optional.
			const parts = (labels: string[]) => [
				...yearParts("example", "localAuthority", 2024)(labels),
				{ key: "2030", header: { id: "example2030" } },
			];
			expect(() =>
				rebuildFromDeclaration(
					database,
					{ ...config, payload: { ...config.payload!, parts } },
					"example",
				),
			).toThrow("declare the part optional");
			const optional = (labels: string[]) =>
				parts(labels).map((part) =>
					part.key === "2030"
						? { ...part, optional: true as const }
						: part,
				);
			expect(
				Object.keys(
					JSON.parse(
						rebuildFromDeclaration(
							database,
							{
								...config,
								payload: {
									...config.payload!,
									parts: optional,
								},
							},
							"example",
						),
					),
				),
			).toEqual(["2024"]);
		} finally {
			database.close();
		}
	});

	it("generates air quality from observations, with null where one area lacks a value", () => {
		const config = STATISTICS_DATASETS.find(
			(dataset) => dataset.type === "air-quality",
		);
		expect(config).toBeDefined();
		if (!config) throw new Error("Missing air quality declaration");
		const expected = {
			"2024": {
				id: "air-quality2024",
				year: 2024,
				type: "air-quality",
				boundaryType: "localAuthority",
				boundaryYear: 2024,
				data: {
					E06000001: {
						ladCode: "E06000001",
						ladName: "Publisher name",
						no2Mean: 12,
						pm25Mean: null,
						pm10Mean: 8,
						gridCells: 4,
						pm25PopulationWeighted: 7,
						pm25PopulationWeightedAnthropogenic: 3,
					},
					E06000002: {
						ladCode: "E06000002",
						ladName: "Middlesbrough",
						no2Mean: 13,
						pm25Mean: 6,
						pm10Mean: 9,
						gridCells: 5,
						pm25PopulationWeighted: 8,
						pm25PopulationWeightedAnthropogenic: 4,
					},
				},
			},
		};
		const database = new DatabaseSync(":memory:");
		database.exec(
			"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload BLOB)",
		);
		try {
			writeSqliteTables(database, {
				...areas(),
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(expected), {
						...entry,
						output: "air-quality",
					}),
				]),
			});
			expect(
				JSON.parse(
					rebuildDatasetPayload(
						database,
						"air-quality",
						"air-quality",
					),
				),
			).toEqual(expected);
		} finally {
			database.close();
		}
	});

	it("fills periods a record lacks with null unless declared sparse", () => {
		const config: DeclaredDataset = {
			type: "example",
			module: "economy",
			name: "name",
			measures: [CRIMES],
			fields: [{ path: "by.{period}", measure: "crimes" }],
			payload: {
				parts: yearParts("example", "localAuthority", 2024, {}, [
					"2024",
				]),
				code: "code",
				without: (relations) => (relations.size ? [] : ["secret"]),
			},
		};
		const record = (code: string, name: string, by: object) => ({
			code,
			name,
			by,
		});
		const expected = JSON.parse(
			file({
				E06000001: record("E06000001", "Hartlepool", {
					2023: 1,
					2024: 2,
				}),
				E06000002: record("E06000002", "Middlesbrough", {
					2023: null,
					2024: 3,
				}),
			}),
		);
		const database = write(config, JSON.stringify(expected));
		try {
			const generate = (payload: DeclaredDataset["payload"]) =>
				JSON.parse(
					rebuildFromDeclaration(
						database,
						{ ...config, payload },
						"example",
					),
				);
			expect(generate(config.payload)).toEqual(expected);
			const sparse = generate({
				...config.payload!,
				sparsePeriods: true,
			});
			expect(sparse["2024"].data.E06000002.by).toEqual({ 2024: 3 });
		} finally {
			database.close();
		}
	});

	it("generates nested bindings and fixed text per record", () => {
		const config: DeclaredDataset = {
			type: "example",
			module: "economy",
			name: "name",
			measures: [CRIMES],
			dimensions: [{ slug: "group", label: "Group" }],
			fields: [{ path: "{group}.{group}.n", measure: "crimes" }],
			payload: {
				parts: yearParts("example", "localAuthority", 2024),
				fill: (record) => {
					for (const group of Object.values(record))
						if (typeof group === "object" && group !== null)
							for (const entry of Object.values(group))
								(entry as Record<string, unknown>).tag = "x";
				},
			},
		};
		const expected = JSON.parse(
			file({
				E06000001: {
					name: "Hartlepool",
					Big: {
						One: { n: 1, tag: "x" },
						Two: { n: 2, tag: "x" },
					},
					Small: { Three: { n: 3, tag: "x" } },
				},
			}),
		);
		const database = write(config, JSON.stringify(expected));
		try {
			expect(
				JSON.parse(rebuildFromDeclaration(database, config, "example")),
			).toEqual(expected);
		} finally {
			database.close();
		}
	});

	it("generates several record sets, each on its own release", () => {
		const config: DeclaredDataset = {
			type: "example",
			module: "economy",
			name: "name",
			measures: [CRIMES],
			fields: [{ path: "total", measure: "crimes" }],
			records: [
				{ from: "data" },
				{
					from: "regions",
					release: () => ({ geography: "region", year: 2025 }),
				},
			],
			payload: {
				parts: yearParts("example", "localAuthority", 2024),
				code: { data: "code", regions: "regionCode" },
				dropped: ["note"],
			},
		};
		const expected = JSON.parse(
			file(
				{
					E06000001: {
						name: "Hartlepool",
						code: "E06000001",
						total: 3,
					},
				},
				{
					regions: {
						E12000001: {
							regionCode: "E12000001",
							total: 9,
							name: "North East",
						},
					},
				},
			),
		);
		const database = write(config, JSON.stringify(expected));
		try {
			expect(
				JSON.parse(rebuildFromDeclaration(database, config, "example")),
			).toEqual(expected);
		} finally {
			database.close();
		}
	});

	it("stores header links as relationships and generates them back", () => {
		const config: DeclaredDataset = {
			type: "example",
			module: "economy",
			name: "name",
			measures: [CRIMES],
			fields: [{ path: "total", measure: "crimes" }],
			headerRelationships: [
				{
					field: "links",
					child: { geography: "localAuthority", year: 2024 },
					parent: { geography: "region", year: 2025 },
				},
			],
			payload: { parts: yearParts("example", "localAuthority", 2024) },
		};
		const expected = JSON.parse(
			file(
				{ E06000001: { name: "Hartlepool", total: 3 } },
				{ links: { E06000001: "E12000001", E06000002: "E12000001" } },
			),
		);
		const database = write(config, JSON.stringify(expected));
		try {
			expect(
				database
					.prepare(
						"SELECT relation, child_version_id, parent_version_id FROM area_relationship ORDER BY child_version_id",
					)
					.all()
					.map((row) => Object.values(row)),
			).toEqual([
				["parent", 1, 4],
				["parent", 2, 4],
			]);
			expect(
				JSON.parse(rebuildFromDeclaration(database, config, "example")),
			).toEqual(expected);
		} finally {
			database.close();
		}
	});

	it("generates election text, winners and derived turnout from rows", () => {
		const config: DeclaredDataset = {
			type: "example",
			module: "economy",
			name: "name",
			period: () => periods.date("2024-07-04"),
			measures: [CRIMES],
			dimensions: [{ slug: "party", label: "Party" }],
			fields: [{ path: "votes.{party}", measure: "crimes" }],
			election: {
				kind: "general",
				date: () => "2024-07-04",
				results: "results",
				parties: [{ key: "LAB", name: "Labour", colour: "#e91d0e" }],
				areas: { region: "region" },
				contest: {
					region: "regionName",
					result: "result",
					first_party: "firstParty",
					second_party: "secondParty",
				},
				elected: { given_name: "first" },
			},
			derived: { total: "The sum of the votes." },
			computed: {
				total: (record) =>
					Object.values(
						record.votes as Record<string, number>,
					).reduce((sum, votes) => sum + votes, 0),
			},
			payload: {
				parts: () => [
					{
						key: "2024",
						header: {
							id: "example2024",
							type: "example",
							year: 2024,
							boundaryType: "localAuthority",
							boundaryYear: 2024,
						},
					},
				],
				omitMissing: ["votes."],
			},
		};
		const expected = JSON.parse(
			file(
				{
					E06000001: {
						name: "Hartlepool",
						regionName: "North East",
						result: "Lab gain",
						firstParty: "Lab",
						secondParty: "Xyz",
						first: "Jo",
						votes: { LAB: 3, CON: 2 },
						total: 5,
					},
					E06000002: {
						name: "Middlesbrough",
						regionName: "Scotland",
						result: null,
						firstParty: null,
						secondParty: null,
						first: null,
						votes: { LAB: 4 },
						total: 4,
					},
				},
				{ results: { E06000001: "LAB", E06000002: "LAB" } },
			),
		);
		const database = write(config, JSON.stringify(expected));
		try {
			expect(
				JSON.parse(rebuildFromDeclaration(database, config, "example")),
			).toEqual(expected);
			// A region that is a held area is stored as that area, else as text.
			expect(
				database
					.prepare(
						"SELECT a.code AS code, region_area_version_id AS area, region_text AS text FROM contest c JOIN area_version v ON v.id = c.area_version_id JOIN area a ON a.id = v.area_id ORDER BY a.code",
					)
					.all()
					.map((row) => ({ ...row })),
			).toEqual([
				{ code: "E06000001", area: 4, text: null },
				{ code: "E06000002", area: null, text: "Scotland" },
			]);
			expect(
				database
					.prepare("SELECT region FROM v_contest ORDER BY area_code")
					.all()
					.map((row) => row.region),
			).toEqual(["North East", "Scotland"]);
			// A party is one row whichever way the publisher spells it.
			expect(
				database
					.prepare(
						"SELECT code, key, name, colour FROM party ORDER BY code",
					)
					.all()
					.map((row) => ({ ...row })),
			).toEqual([
				{ code: "Lab", key: "LAB", name: "Labour", colour: "#e91d0e" },
				{ code: "Xyz", key: "XYZ", name: "Xyz", colour: null },
			]);
			expect(
				database
					.prepare(
						"SELECT area_code, first_party, second_party, winner FROM v_contest ORDER BY area_code",
					)
					.all()
					.map((row) => ({ ...row })),
			).toEqual([
				{
					area_code: "E06000001",
					first_party: "Lab",
					second_party: "Xyz",
					winner: "LAB",
				},
				{
					area_code: "E06000002",
					first_party: null,
					second_party: null,
					winner: "LAB",
				},
			]);
		} finally {
			database.close();
		}
	});

	it("reads a candidate's party votes and share from the observations", () => {
		const config: DeclaredDataset = {
			type: "example",
			module: "politics",
			name: "name",
			period: () => periods.date("2024-07-04"),
			measures: [
				measure(
					"party-votes",
					"Party votes",
					"votes",
					"count",
					"sum",
					"Votes.",
				),
				measure(
					"valid-votes",
					"Valid votes",
					"votes",
					"count",
					"sum",
					"Valid.",
				),
			],
			dimensions: [{ slug: "party", label: "Party" }],
			fields: [
				{ path: "votes.{party}", measure: "party-votes" },
				{ path: "validVotes", measure: "valid-votes" },
			],
			election: {
				kind: "general",
				date: () => "2024-07-04",
				contest: { first_party: "firstParty" },
				elected: { family_name: "family" },
			},
			payload: {
				parts: () => [
					{
						key: "2024",
						header: {
							id: "example2024",
							type: "example",
							year: 2024,
							boundaryType: "localAuthority",
							boundaryYear: 2024,
						},
					},
				],
			},
		};
		const text = file({
			E06000001: {
				name: "Hartlepool",
				firstParty: "Lab",
				family: "Smith",
				votes: { LAB: 30, CON: 10 },
				validVotes: 40,
			},
			E06000002: {
				name: "Middlesbrough",
				firstParty: null,
				votes: { LAB: 4 },
				validVotes: 4,
			},
		});
		const database = write(config, text);
		try {
			expect(
				database
					.prepare(
						"SELECT area_code, family_name, party, party_votes, valid_votes, party_vote_share FROM v_candidacy",
					)
					.all()
					.map((row) => ({ ...row })),
			).toEqual([
				{
					area_code: "E06000001",
					family_name: "Smith",
					party: "Lab",
					party_votes: 30,
					valid_votes: 40,
					party_vote_share: 75,
				},
			]);
		} finally {
			database.close();
		}
	});

	it("generates parents per record set, with null where a record has none", () => {
		const config: DeclaredDataset = {
			type: "example",
			module: "economy",
			name: { data: "name", regions: "regionName" },
			measures: [CRIMES],
			fields: [{ path: "total", measure: "crimes" }],
			records: [
				{ from: "data" },
				{
					from: "regions",
					release: () => ({ geography: "region", year: 2025 }),
				},
			],
			parents: [
				{
					sets: ["regions"],
					nullable: true,
					relation: "coterminous",
					code: "authorityCode",
					release: { geography: "localAuthority", year: 2024 },
				},
			],
			payload: {
				parts: yearParts("example", "localAuthority", 2024),
				code: { data: "code", regions: "regionCode" },
			},
		};
		const expected = JSON.parse(
			file(
				{
					E06000001: {
						name: "Hartlepool",
						code: "E06000001",
						total: 3,
					},
				},
				{
					regions: {
						E12000001: {
							regionName: "North East",
							regionCode: "E12000001",
							authorityCode: null,
							total: 9,
						},
					},
				},
			),
		);
		const database = write(config, JSON.stringify(expected));
		try {
			expect(
				JSON.parse(rebuildFromDeclaration(database, config, "example")),
			).toEqual(expected);
		} finally {
			database.close();
		}
	});

	it("generates parent areas and header summaries from rows", () => {
		const config: DeclaredDataset = {
			type: "example",
			module: "economy",
			name: "name",
			alsoIn: [{ geography: "localAuthority", year: 2022 }],
			measures: [CRIMES],
			fields: [{ path: "total", measure: "crimes" }],
			parents: [
				{
					code: "regionCode",
					name: "regionName",
					release: { geography: "region", year: 2025 },
				},
			],
			payload: {
				parts: yearParts("example", "localAuthority", 2024),
				code: "code",
				summary: (records) => ({
					total: Object.values(records).reduce<number>(
						(sum, record) =>
							sum + ((record as { total: number }).total ?? 0),
						0,
					),
				}),
			},
		};
		const record = (code: string, name: string, total: number) => ({
			code,
			name,
			regionCode: "E12000001",
			regionName: "North East England",
			total,
		});
		const expected = JSON.parse(
			file(
				{
					E06000001: record("E06000001", "Hartlepool", 3),
					E06000002: record("E06000002", "Middlesbrough", 4),
				},
				{ total: 7 },
			),
		);
		const database = write(config, JSON.stringify(expected));
		try {
			expect(
				JSON.parse(rebuildFromDeclaration(database, config, "example")),
			).toEqual(expected);
		} finally {
			database.close();
		}
	});

	it("maps fields, members, periods, intervals and releases from configuration", () => {
		const config: DeclaredDataset = {
			type: "example",
			module: "economy",
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
				module: "economy",
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

	it("marks values with the status a record field holds", () => {
		const database = write(
			{
				type: "example",
				module: "economy",
				measures: [RATE],
				fields: [
					{
						path: "value",
						measure: "rate",
						status: {
							path: "known",
							values: { observed: true, estimated: false },
						},
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

	it("refuses a status field holding no listed status", () => {
		expect(() =>
			write(
				{
					type: "example",
					module: "economy",
					measures: [RATE],
					fields: [
						{
							path: "value",
							measure: "rate",
							status: {
								path: "known",
								values: { observed: true },
							},
						},
					],
				},
				file({ E06000001: { value: 1, known: false } }),
			),
		).toThrow(
			"example 2024: known in E06000001 is false, no listed status",
		);
	});

	it("refuses numbers no field claims", () => {
		expect(() =>
			write(
				{
					type: "example",
					module: "economy",
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
					module: "economy",
					measures: [CRIMES],
					fields: [{ path: "total", measure: "crimes" }],
				},
				file({ E07000026: { total: 1 } }),
			),
		).toThrow("example 2024: area E07000026 is in no listed release");
	});

	it("places records on a fallback until their true year's release is held", () => {
		const text = JSON.stringify({
			2025: {
				boundaryType: "localAuthority",
				boundaryYear: 2025,
				data: { E06000001: { total: 3 } },
			},
		});
		const database = write(
			{
				type: "example",
				module: "economy",
				alsoIn: [{ geography: "localAuthority", year: 2024 }],
				measures: [CRIMES],
				fields: [{ path: "total", measure: "crimes" }],
			},
			text,
		);
		expect(
			database
				.prepare("SELECT area_code, release FROM v_observation")
				.all()
				.map((row) => ({ ...row })),
		).toEqual([{ area_code: "E06000001", release: "2024-05-uk-bgc" }]);
		expect(() =>
			write(
				{
					type: "example",
					module: "economy",
					measures: [CRIMES],
					fields: [{ path: "total", measure: "crimes" }],
				},
				text,
			),
		).toThrow("example 2025: the atlas holds none of localAuthority 2025");
	});

	it("refuses keys that are not declared members", () => {
		expect(() =>
			write(
				{
					type: "example",
					module: "economy",
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

	describe("generated payloads", () => {
		const generated = (config: DeclaredDataset, text: string) => {
			const database = write(config, text);
			try {
				return JSON.parse(
					rebuildFromDeclaration(database, config, "example"),
				);
			} finally {
				database.close();
			}
		};
		const payload = {
			parts: yearParts("example", "localAuthority", 2024, {}, ["2024"]),
		};

		it("generates values in arrays, keyed by index", () => {
			const listed: DeclaredDataset = {
				type: "example",
				module: "economy",
				name: "name",
				alsoIn: [{ geography: "localAuthority", year: 2022 }],
				measures: [CRIMES],
				fields: [
					{
						path: "counts.{period}",
						measure: "crimes",
						period: (index) => periods.year(2020 + Number(index)),
					},
				],
				payload: {
					...payload,
					arrays: ["counts"],
					periodKeys: ["0", "1", "2"],
					sparsePeriods: true,
					emptyArrays: ["counts"],
				},
			};
			const expected = JSON.parse(
				file({
					E06000001: { name: "Hartlepool", counts: [3, null, 5] },
					E06000002: { name: "Middlesbrough", counts: [4, 6] },
				}),
			);
			expect(generated(listed, JSON.stringify(expected))).toEqual(
				expected,
			);
		});

		it("generates a status field from the observation's status", () => {
			const flagged: DeclaredDataset = {
				type: "example",
				module: "economy",
				measures: [RATE],
				fields: [
					{
						path: "value",
						measure: "rate",
						status: {
							path: "known",
							values: { observed: true, estimated: false },
						},
					},
				],
				payload,
			};
			const expected = JSON.parse(
				file({
					E06000001: { value: 1, known: true },
					E06000002: { value: 2, known: false },
				}),
			);
			expect(generated(flagged, JSON.stringify(expected))).toEqual(
				expected,
			);
		});

		it("generates records keyed by something other than their code", () => {
			const keyed: DeclaredDataset = {
				type: "example",
				module: "economy",
				name: "name",
				keys: { QHM: "E06000001" },
				measures: [CRIMES],
				fields: [{ path: "total", measure: "crimes" }],
				payload: { ...payload, code: "code" },
			};
			const expected = JSON.parse(
				file({
					QHM: { code: "QHM", name: "HARTLEPOOL", total: 3 },
					E06000002: {
						code: "E06000002",
						name: "Middlesbrough",
						total: 4,
					},
				}),
			);
			const database = write(keyed, JSON.stringify(expected));
			try {
				expect(
					JSON.parse(
						rebuildFromDeclaration(database, keyed, "example"),
					),
				).toEqual(expected);
				expect(
					database.prepare("SELECT key FROM dataset_area_key").all(),
				).toEqual([{ key: "QHM" }]);
			} finally {
				database.close();
			}
		});

		it("computes a derived number from another dataset's rows", () => {
			const people: DeclaredDataset = {
				type: "people",
				module: "economy",
				name: "name",
				measures: [
					measure(
						"residents",
						"Residents",
						"people",
						"count",
						"sum",
						"Residents.",
					),
				],
				fields: [{ path: "total", measure: "residents" }],
				payload: {
					parts: yearParts("people", "localAuthority", 2024),
				},
			};
			const rated: DeclaredDataset = {
				type: "example",
				module: "economy",
				name: "name",
				measures: [CRIMES],
				fields: [{ path: "total", measure: "crimes" }],
				derived: { perResident: "Crimes over the area's residents." },
				computed: {
					perResident: (record, _path, { code, header, dataset }) => {
						const part = dataset("people")[String(header.year)] as {
							data: Record<string, { total: number }>;
						};
						return (
							(record.total as number) / part.data[code]!.total
						);
					},
				},
				payload,
			};
			const peopleText = file({
				E06000001: { name: "Hartlepool", total: 90 },
				E06000002: { name: "Middlesbrough", total: 140 },
			});
			const expected = JSON.parse(
				file({
					E06000001: {
						name: "Hartlepool",
						total: 3,
						perResident: 3 / 90,
					},
					E06000002: {
						name: "Middlesbrough",
						total: 7,
						perResident: 7 / 140,
					},
				}),
			);
			const database = new DatabaseSync(":memory:");
			database.exec(
				"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload BLOB)",
			);
			try {
				writeSqliteTables(database, {
					...areas(),
					...statisticsTables([
						declaredStatistics(people, () => peopleText, {
							...entry,
							output: "people",
						}),
						declaredStatistics(
							rated,
							() => JSON.stringify(expected),
							entry,
						),
					]),
				});
				expect(
					JSON.parse(
						rebuildFromDeclaration(database, rated, "example", () =>
							JSON.parse(peopleText),
						),
					),
				).toEqual(expected);
			} finally {
				database.close();
			}
		});
	});
});
