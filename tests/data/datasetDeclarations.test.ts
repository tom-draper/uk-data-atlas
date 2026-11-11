import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
	rebuildDatasetPayload,
	comparableCompiled,
} from "@uk-data-atlas/catalogue/node";
import {
	declaredStatistics,
	STATISTICS_DATASETS,
} from "@uk-data-atlas/measures";
import {
	DATASET_DECLARATIONS,
	DECLARED_DEFINITIONS,
} from "@uk-data-atlas/datasets";
import {
	CATALOGUE_DATASET_DEFINITIONS,
	HAND_WRITTEN_DATASET_DEFINITIONS,
} from "@uk-data-atlas/datasets";
import { DATASET_MODULES, isDatasetModule } from "@uk-data-atlas/datasets";
import { UPDATE_CADENCES } from "@uk-data-atlas/datasets";
import { statisticsTables } from "../../pipeline/src/storage/index";
import { writeSqliteTables } from "../../pipeline/src/storage/index";

describe("dataset declarations", () => {
	it("gives every catalogue dataset exactly one definition", () => {
		const declared = DECLARED_DEFINITIONS.map(({ type }) => type);
		const handWritten = HAND_WRITTEN_DATASET_DEFINITIONS.map(
			({ type }) => type,
		);
		const catalogue = CATALOGUE_DATASET_DEFINITIONS.map(({ type }) => type);
		expect(new Set(catalogue).size).toBe(catalogue.length);
		expect(declared.filter((type) => handWritten.includes(type))).toEqual(
			[],
		);
		expect([...declared, ...handWritten].sort()).toEqual(
			[...catalogue].sort(),
		);
	});

	it("uses one kebab-case id for the type, the file and the declaration", () => {
		for (const declaration of DATASET_DECLARATIONS) {
			expect(declaration.id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
			const definition = DECLARED_DEFINITIONS.find(
				({ type }) => type === declaration.id,
			);
			expect(definition?.precompiledFile).toBe(declaration.id);
		}
	});

	it("declares a valid module, a licence and the source terms", () => {
		for (const declaration of DATASET_DECLARATIONS) {
			const { source } = declaration;
			expect(isDatasetModule(declaration.module), declaration.id).toBe(
				true,
			);
			expect(declaration.module, declaration.id).not.toBe("core");
			expect(source.licence, declaration.id).not.toBe("");
			expect(source.licenceUrl, declaration.id).toMatch(/^https?:/);
			expect(source.sourceUrl, declaration.id).toMatch(/^https?:/);
			expect(source.attribution, declaration.id).not.toBe("");
			expect(UPDATE_CADENCES).toContain(source.cadence);
		}
	});

	it("gives every statistics declaration a unique type and a module", () => {
		const types = STATISTICS_DATASETS.map(({ type }) => type);
		expect(new Set(types).size).toBe(types.length);
		for (const dataset of STATISTICS_DATASETS)
			expect(DATASET_MODULES).toContain(dataset.module);
	});

	it("keeps the measure ids of a declaration unique", () => {
		const ids = DATASET_DECLARATIONS.flatMap((declaration) =>
			(declaration.catalogue?.indicators ?? []).map(({ id }) => id),
		);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe("declared dataset rows", () => {
	const declaration = DATASET_DECLARATIONS.find(
		({ id }) => id === "claimant-count",
	)!;
	const areas = {
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
			],
		},
		geography: {
			rowid: true,
			columns: ["id INTEGER", "slug TEXT"],
			key: ["id"],
			rows: [[1, "localAuthority"]],
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
			],
		},
	};
	const compiled = {
		"2026": {
			id: "claimant-count2026",
			type: "claimant-count",
			year: 2026,
			month: "Apr 2026",
			boundaryType: "localAuthority",
			boundaryYear: 2024,
			data: {
				E06000001: {
					ladCode: "E06000001",
					ladName: "Hartlepool",
					totalCount: 2500,
					totalRate: 4.5,
					youthCount: 500,
					youthRate: 0.9,
				},
				E06000002: {
					ladCode: "E06000002",
					ladName: "Middlesbrough",
					totalCount: 4000,
					totalRate: 5,
					youthCount: 1000,
					youthRate: 1.25,
				},
			},
		},
	};

	it("is registered for statistics under its id with its module", () => {
		const config = STATISTICS_DATASETS.find(
			({ type }) => type === "claimant-count",
		);
		expect(config?.module).toBe("economy");
	});

	it("stores rows and generates the compiled payload back from them", () => {
		const config = STATISTICS_DATASETS.find(
			({ type }) => type === "claimant-count",
		)!;
		const database = new DatabaseSync(":memory:");
		database.exec(
			"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload BLOB)",
		);
		try {
			writeSqliteTables(database, {
				...areas,
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: declaration.id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(
				database
					.prepare("SELECT slug, module FROM dataset")
					.all()
					.map((row) => ({ ...row })),
			).toEqual([{ slug: "claimant-count", module: "economy" }]);
			expect(
				JSON.parse(
					rebuildDatasetPayload(
						database,
						"claimant-count",
						"claimant-count",
					),
				),
			).toEqual(compiled);
		} finally {
			database.close();
		}
	});
	it.each([
		["itl1", "TLC", "North East (England)"],
		["itl2", "TLC3", "Tees Valley"],
	])("stores GDP and GVA for %s across years", (tier, code, name) => {
		const id = `regional-gdp-${tier}`;
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const compiled = Object.fromEntries(
			[2022, 2023].map((year) => [
				String(year),
				{
					id: `${id}${year}`,
					type: id,
					year,
					boundaryType: tier,
					boundaryYear: 2025,
					coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
					data: {
						[code]: {
							itlCode: code,
							itlName: name,
							gvaMillionGbp: year + 0.5,
							gdpMillionGbp: year + 1.5,
						},
					},
				},
			]),
		);
		const database = new DatabaseSync(":memory:");
		database.exec(
			"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload BLOB)",
		);
		try {
			writeSqliteTables(database, {
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, tier, "2025-01-uk-bgc", "available"],
					],
				},
				geography: {
					...areas.geography,
					rows: [...areas.geography.rows, [2, tier]],
				},
				area: {
					...areas.area,
					rows: [...areas.area.rows, [3, 2, code]],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 3, 2, name]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores local-authority population by age and sex", () => {
		const id = "population-uk";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const males = Array.from({ length: 91 }, (_, age) => age + 1);
		const females = Array.from({ length: 91 }, (_, age) => age + 2);
		const compiled = {
			2024: {
				id: `${id}2024`,
				type: id,
				year: 2024,
				boundaryType: "localAuthority",
				boundaryYear: 2023,
				data: {
					E06000001: {
						ladName: "Hartlepool",
						total: males.map((value, age) => value + females[age]!),
						males,
						females,
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "localAuthority", "2023-12-uk-bgc", "available"],
					],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 1, 2, "Hartlepool"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores collision severities for authorities and small areas", () => {
		const id = "road-collisions";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const compiled = {
			2024: {
				id: `${id}2024`,
				type: id,
				year: 2024,
				period: "January to December 2024",
				boundaryType: "localAuthority",
				boundaryYear: 2024,
				lsoaBoundaryYear: 2021,
				coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
				data: {
					E06000001: {
						ladCode: "E06000001",
						collisions: 12,
						fatal: 1,
						serious: 3,
						slight: 8,
					},
				},
				lsoas: {
					E01012194: {
						lsoaCode: "E01012194",
						collisions: 4,
						fatal: 0,
						serious: 1,
						slight: 3,
					},
				},
				excluded: [],
				withoutLsoa: {},
			},
		};
		const database = new DatabaseSync(":memory:");
		database.exec(
			"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload BLOB)",
		);
		try {
			writeSqliteTables(database, {
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "lsoa", "2021-12-ew-bgc-v5", "available"],
					],
				},
				geography: {
					...areas.geography,
					rows: [...areas.geography.rows, [2, "lsoa"]],
				},
				area: {
					...areas.area,
					rows: [...areas.area.rows, [3, 2, "E01012194"]],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 3, 2, "Example"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				comparableCompiled(id, compiled),
			);
		} finally {
			database.close();
		}
	});
	it("stores historical election dates and constituency vote totals", () => {
		const id = "historical-general-election";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const compiled = {
			2019: {
				id: `${id}-2019`,
				type: id,
				election: "2019",
				year: 2019,
				boundaryType: "constituency",
				boundaryYear: 2019,
				boundarySet: "2010-2019",
				data: {
					W07000049: {
						constituencyId: "W07000049",
						constituencyName: "Aberavon",
						region: "Wales",
						seats: 1,
						electorate: 50750,
						votes: { CON: 6518, LAB: 17008 },
						voteShare: { CON: 20.6, LAB: 53.8 },
						totalVotes: 31598,
						turnoutPercent: 62.3,
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "constituency", "2019-12-uk-bgc", "available"],
					],
				},
				geography: {
					...areas.geography,
					rows: [...areas.geography.rows, [2, "constituency"]],
				},
				area: {
					...areas.area,
					rows: [...areas.area.rows, [3, 2, "W07000049"]],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 3, 2, "Aberavon"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(
				database.prepare("SELECT label, date FROM election").get(),
			).toMatchObject({ label: "2019", date: "2019-12-12" });
			expect(
				database.prepare("SELECT area_name FROM contest").get(),
			).toMatchObject({ area_name: "Aberavon" });
			expect(
				database
					.prepare(
						"SELECT sum(o.value) AS votes FROM observation o JOIN series s ON s.id = o.series_id JOIN measure m ON m.id = s.measure_id WHERE m.slug = 'party-votes'",
					)
					.get(),
			).toMatchObject({ votes: 23526 });
		} finally {
			database.close();
		}
	});
	it("stores school results by academic year and preserves suppressed progress", () => {
		const id = "school-performance-constituency";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const latest = {
			ptL2basics94: 70.8,
			ptL2basics95: 53.7,
			avgAtt8: 50.3,
			avgP8score: null,
			pupils: 1272,
		};
		const compiled = {
			2025: {
				id: `${id}2025`,
				type: id,
				year: 2025,
				boundaryType: "constituency",
				boundaryYear: 2024,
				coverageCountries: ["GB-ENG"],
				data: {
					E14001502: {
						pconCode: "E14001502",
						pconName: "Southend West and Leigh",
						...latest,
						series: {
							2024: {
								ptL2basics94: 72,
								ptL2basics95: 53.1,
								avgAtt8: 49.8,
								avgP8score: 0.04,
								pupils: 1241,
							},
							2025: latest,
						},
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "constituency", "2024-07-uk-bgc", "available"],
					],
				},
				geography: {
					...areas.geography,
					rows: [...areas.geography.rows, [2, "constituency"]],
				},
				area: {
					...areas.area,
					rows: [...areas.area.rows, [3, 2, "E14001502"]],
				},
				area_version: {
					...areas.area_version,
					rows: [
						...areas.area_version.rows,
						[3, 3, 2, "Southend West and Leigh"],
					],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores net additional dwellings on the 2025 authority release", () => {
		const id = "net-additional-dwellings";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const compiled = {
			2025: {
				id: `${id}2025`,
				type: id,
				year: 2025,
				boundaryType: "localAuthority",
				boundaryYear: 2025,
				coverageCountries: ["GB-ENG"],
				data: {
					E06000001: {
						code: "E06000001",
						name: "Hartlepool",
						value: 123,
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "localAuthority", "2025-05-uk-bgc-v2", "available"],
					],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 1, 2, "Hartlepool"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores education-services budgets on the 2026 authority release", () => {
		const id = "local-government-finance";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const compiled = {
			2026: {
				id: `${id}2026`,
				type: id,
				year: 2026,
				boundaryType: "localAuthority",
				boundaryYear: 2026,
				coverageCountries: ["GB-ENG"],
				data: {
					E06000001: {
						code: "E06000001",
						name: "Hartlepool",
						value: 12345,
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "localAuthority", "2026-05-uk-bgc", "available"],
					],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 1, 2, "Hartlepool"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores adult social care activity on the 2025 authority release", () => {
		const id = "adult-social-care-activity";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const compiled = {
			2025: {
				id: `${id}2025`,
				type: id,
				year: 2025,
				boundaryType: "localAuthority",
				boundaryYear: 2025,
				coverageCountries: ["GB-ENG"],
				data: {
					E06000001: {
						code: "E06000001",
						name: "Hartlepool",
						value: 1234,
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "localAuthority", "2025-05-uk-bgc-v2", "available"],
					],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 1, 2, "Hartlepool"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores adult social care outcomes on the 2025 authority release", () => {
		const id = "adult-social-care-outcomes";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const compiled = {
			2025: {
				id: `${id}2025`,
				type: id,
				year: 2025,
				boundaryType: "localAuthority",
				boundaryYear: 2025,
				coverageCountries: ["GB-ENG"],
				data: {
					E06000001: {
						code: "E06000001",
						name: "Hartlepool",
						value: 18.3,
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "localAuthority", "2025-05-uk-bgc-v2", "available"],
					],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 1, 2, "Hartlepool"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores housing affordability on the 2025 authority release", () => {
		const id = "housing-affordability";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const compiled = {
			2025: {
				id: `${id}2025`,
				type: id,
				year: 2025,
				boundaryType: "localAuthority",
				boundaryYear: 2025,
				coverageCountries: ["GB-ENG", "GB-WLS"],
				data: {
					E06000001: {
						code: "E06000001",
						name: "Hartlepool",
						value: 8.7,
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "localAuthority", "2025-05-uk-bgc-v2", "available"],
					],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 1, 2, "Hartlepool"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores electric vehicle charger counts on the 2026 authority release", () => {
		const id = "electric-vehicle-chargers";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const population = DATASET_DECLARATIONS.find(
			(entry) => entry.id === "population-uk",
		)!;
		const populationConfig = STATISTICS_DATASETS.find(
			(entry) => entry.type === population.id,
		)!;
		const populationCompiled = {
			2024: {
				id: "population-uk2024",
				type: "population-uk",
				year: 2024,
				boundaryType: "localAuthority",
				boundaryYear: 2023,
				data: {
					E06000001: {
						ladName: "Hartlepool",
						total: Array(91).fill(100),
						males: Array(91).fill(50),
						females: Array(91).fill(50),
					},
				},
			},
		};
		const compiled = {
			2026: {
				id: `${id}2026`,
				type: id,
				year: 2026,
				boundaryType: "localAuthority",
				boundaryYear: 2026,
				coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
				data: {
					E06000001: {
						code: "E06000001",
						name: "Hartlepool",
						value: 123,
						metrics: { per100kPopulation: (123 / 9100) * 100000 },
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "localAuthority", "2026-05-uk-bgc", "available"],
						[3, "localAuthority", "2023-12-uk-bgc", "available"],
					],
				},
				area_version: {
					...areas.area_version,
					rows: [
						...areas.area_version.rows,
						[3, 1, 2, "Hartlepool"],
						[4, 1, 3, "Hartlepool"],
					],
				},
				...statisticsTables(
					[
						declaredStatistics(
							populationConfig,
							() => JSON.stringify(populationCompiled),
							{
								output: population.id,
								fingerprint: "sha256:fixture",
								source: {
									name: population.source.name,
									source: population.source.publisher,
									sourceUrl: population.source.sourceUrl,
									licence: population.source.licence,
									licenceUrl: population.source.licenceUrl,
									description: population.source.description,
								},
							},
						),
						declaredStatistics(
							config,
							() => JSON.stringify(compiled),
							{
								output: id,
								fingerprint: "sha256:fixture",
								source: {
									name: declaration.source.name,
									source: declaration.source.publisher,
									sourceUrl: declaration.source.sourceUrl,
									licence: declaration.source.licence,
									licenceUrl: declaration.source.licenceUrl,
									description: declaration.source.description,
								},
							},
						),
					],
					undefined,
					new Map([
						[
							population.id,
							{
								type: population.id,
								sha256: "sha256:fixture",
								bytes: 1,
								payloadId: null,
							},
						],
					]),
				),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores business counts and population rates on the 2025 authority release", () => {
		const id = "business-activity";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const population = DATASET_DECLARATIONS.find(
			(entry) => entry.id === "population-uk",
		)!;
		const populationConfig = STATISTICS_DATASETS.find(
			(entry) => entry.type === population.id,
		)!;
		const populationCompiled = {
			2024: {
				id: "population-uk2024",
				type: "population-uk",
				year: 2024,
				boundaryType: "localAuthority",
				boundaryYear: 2023,
				data: {
					E06000001: {
						ladName: "Hartlepool",
						total: Array(91).fill(100),
						males: Array(91).fill(50),
						females: Array(91).fill(50),
					},
				},
			},
		};
		const compiled = {
			2025: {
				id: `${id}2025`,
				type: id,
				year: 2025,
				boundaryType: "localAuthority",
				boundaryYear: 2025,
				coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
				data: {
					E06000001: {
						code: "E06000001",
						name: "Hartlepool",
						value: 123,
						metrics: { per100kPopulation: (123 / 9100) * 100000 },
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "localAuthority", "2025-05-uk-bgc-v2", "available"],
						[3, "localAuthority", "2023-12-uk-bgc", "available"],
					],
				},
				area_version: {
					...areas.area_version,
					rows: [
						...areas.area_version.rows,
						[3, 1, 2, "Hartlepool"],
						[4, 1, 3, "Hartlepool"],
					],
				},
				...statisticsTables(
					[
						declaredStatistics(
							populationConfig,
							() => JSON.stringify(populationCompiled),
							{
								output: population.id,
								fingerprint: "sha256:fixture",
								source: {
									name: population.source.name,
									source: population.source.publisher,
									sourceUrl: population.source.sourceUrl,
									licence: population.source.licence,
									licenceUrl: population.source.licenceUrl,
									description: population.source.description,
								},
							},
						),
						declaredStatistics(
							config,
							() => JSON.stringify(compiled),
							{
								output: id,
								fingerprint: "sha256:fixture",
								source: {
									name: declaration.source.name,
									source: declaration.source.publisher,
									sourceUrl: declaration.source.sourceUrl,
									licence: declaration.source.licence,
									licenceUrl: declaration.source.licenceUrl,
									description: declaration.source.description,
								},
							},
						),
					],
					undefined,
					new Map([
						[
							population.id,
							{
								type: population.id,
								sha256: "sha256:fixture",
								bytes: 1,
								payloadId: null,
							},
						],
					]),
				),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores council tax on the 2026 authority release", () => {
		const id = "council-tax";
		const declaration = DATASET_DECLARATIONS.find(
			(entry) => entry.id === id,
		)!;
		const config = STATISTICS_DATASETS.find((entry) => entry.type === id)!;
		const compiled = {
			2026: {
				id: `${id}2026`,
				type: id,
				year: 2026,
				boundaryType: "localAuthority",
				boundaryYear: 2026,
				coverageCountries: ["GB-ENG"],
				data: {
					E06000001: {
						code: "E06000001",
						name: "Hartlepool",
						value: 2207.55,
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "localAuthority", "2026-05-uk-bgc", "available"],
					],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 1, 2, "Hartlepool"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(JSON.parse(rebuildDatasetPayload(database, id, id))).toEqual(
				compiled,
			);
		} finally {
			database.close();
		}
	});
	it("stores constituency population for each published year", () => {
		const declaration = DATASET_DECLARATIONS.find(
			({ id }) => id === "population-constituency",
		)!;
		const config = STATISTICS_DATASETS.find(
			({ type }) => type === declaration.id,
		)!;
		const compiled = Object.fromEntries(
			[2021, 2022].map((year) => [
				String(year),
				{
					id: `population-constituency${year}`,
					type: "population-constituency",
					year,
					boundaryType: "constituency",
					boundaryYear: 2024,
					coverageCountries: ["GB-ENG", "GB-WLS"],
					data: {
						E14001063: {
							constituencyCode: "E14001063",
							constituencyName: "Example",
							total: year * 30,
						},
					},
				},
			]),
		);
		const database = new DatabaseSync(":memory:");
		database.exec(
			"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload BLOB)",
		);
		try {
			writeSqliteTables(database, {
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "constituency", "2024-07-uk-bgc", "available"],
					],
				},
				geography: {
					...areas.geography,
					rows: [...areas.geography.rows, [2, "constituency"]],
				},
				area: {
					...areas.area,
					rows: [...areas.area.rows, [3, 2, "E14001063"]],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 3, 2, "Example"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: declaration.id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(
				JSON.parse(
					rebuildDatasetPayload(
						database,
						declaration.id,
						declaration.id,
					),
				),
			).toEqual(compiled);
		} finally {
			database.close();
		}
	});
	it("stores life-expectancy periods and confidence intervals as rows", () => {
		const declaration = DATASET_DECLARATIONS.find(
			({ id }) => id === "life-expectancy-series",
		)!;
		const config = STATISTICS_DATASETS.find(
			({ type }) => type === declaration.id,
		)!;
		const compiled = {
			2024: {
				id: "life-expectancy-series2024",
				type: "life-expectancy-series",
				year: 2024,
				period: "2022-2024",
				boundaryType: "localAuthority",
				boundaryYear: 2025,
				coverageCountries: ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"],
				data: {
					E06000001: {
						ladCode: "E06000001",
						ladName: "Hartlepool",
						male: { value: 76, lower: 75, upper: 77 },
						female: { value: 80, lower: 79, upper: 81 },
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
				...areas,
				area_releases: {
					...areas.area_releases,
					rows: [
						...areas.area_releases.rows,
						[2, "localAuthority", "2025-05-uk-bgc-v2", "available"],
					],
				},
				area_version: {
					...areas.area_version,
					rows: [...areas.area_version.rows, [3, 1, 2, "Hartlepool"]],
				},
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: declaration.id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(
				JSON.parse(
					rebuildDatasetPayload(
						database,
						declaration.id,
						declaration.id,
					),
				),
			).toEqual(compiled);
		} finally {
			database.close();
		}
	});
	it("stores land-area measures and derives square kilometres from rows", () => {
		const declaration = DATASET_DECLARATIONS.find(
			({ id }) => id === "land-area",
		)!;
		const config = STATISTICS_DATASETS.find(
			({ type }) => type === "land-area",
		)!;
		const compiled = {
			2024: {
				id: "land-area2024",
				type: "land-area",
				year: 2024,
				boundaryType: "localAuthority",
				boundaryYear: 2024,
				coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
				data: {
					E06000001: {
						ladCode: "E06000001",
						ladName: "Hartlepool",
						landHectares: 120,
						landSquareKm: 1.2,
						extentHectares: 140,
						inlandWaterHectares: 20,
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
				...areas,
				...statisticsTables([
					declaredStatistics(config, () => JSON.stringify(compiled), {
						output: declaration.id,
						fingerprint: "sha256:fixture",
						source: {
							name: declaration.source.name,
							source: declaration.source.publisher,
							sourceUrl: declaration.source.sourceUrl,
							licence: declaration.source.licence,
							licenceUrl: declaration.source.licenceUrl,
							description: declaration.source.description,
						},
					}),
				]),
			});
			expect(
				JSON.parse(
					rebuildDatasetPayload(database, "land-area", "land-area"),
				),
			).toEqual(compiled);
		} finally {
			database.close();
		}
	});
});
