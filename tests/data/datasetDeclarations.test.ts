import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { rebuildDatasetPayload } from "@uk-data-atlas/catalogue/node";
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
