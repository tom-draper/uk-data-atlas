import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	statisticsTables,
	type StatisticsDataset,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	fuelPovertyStatistics,
	rebuildFuelPoverty,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	writeSqliteIndex,
	writeSqliteTables,
	type SqliteTable,
} from "@uk-data-atlas/atlas-runtime/storage";
import { readVersionedAtlasDataset } from "@uk-data-atlas/atlas-runtime/storage";

const entry = {
	fingerprint: "sha256:fixture",
	source: {
		name: "Fuel Poverty",
		source: "Department for Energy Security and Net Zero",
		sourceUrl: "https://example.org/fuel-poverty",
		licence: "Open Government Licence v3.0",
		description: "Fuel poverty estimates.",
	},
};

/** Two releases of areas, in the shape `areaTables` writes. */
const areaFixture = (): Record<string, SqliteTable> => ({
	area_releases: {
		columns: [
			"position INTEGER UNIQUE",
			"geography TEXT",
			"id TEXT",
			"status TEXT",
		],
		key: ["geography", "id"],
		rows: [
			[0, "lsoa", "2021-12-ew-bgc-v5", "available"],
			[1, "localAuthority", "2024-05-uk-bgc", "available"],
		],
	},
	areas: {
		rowid: true,
		columns: [
			"id INTEGER",
			"releasePosition INTEGER REFERENCES area_releases(position)",
			"code TEXT",
			"name TEXT",
		],
		key: ["id"],
		rows: [
			[1, 0, "E01000001", "City of London 001A"],
			[2, 0, "E01000002", "City of London 001B"],
			[3, 1, "E09000001", "City of London"],
			[4, 1, "E09000002", "Barking and Dagenham"],
		],
	},
});

const fuelPovertyText = (data: Record<string, object>) =>
	JSON.stringify({
		2024: {
			id: "fuelPoverty2024",
			type: "fuelPoverty",
			year: 2024,
			boundaryType: "lsoa",
			boundaryYear: 2021,
			data,
		},
	});

const record = (
	lsoaCode: string,
	lsoaName: string,
	values: Partial<Record<string, number>> = {},
) => ({
	lsoaCode,
	lsoaName,
	householdCount: 100,
	fuelPoorHouseholdCount: 0,
	fuelPovertyRate: 0,
	...values,
});

const memory = (tables: Record<string, SqliteTable>) => {
	const database = new DatabaseSync(":memory:");
	database.exec("PRAGMA foreign_keys = ON");
	writeSqliteTables(database, { ...areaFixture(), ...tables });
	return database;
};

describe("fuel poverty on the statistics model", () => {
	it("rebuilds the payload byte for byte and serves it without the retained blob", () => {
		const root = mkdtempSync(join(tmpdir(), "statistics-rows-"));
		const path = join(root, "data/build/atlas.sqlite");
		mkdirSync(join(root, "data/build"), { recursive: true });
		const text = fuelPovertyText({
			E01000001: record("E01000001", "City of London 001A", {
				householdCount: 918,
				fuelPoorHouseholdCount: 42,
				fuelPovertyRate: 4.57516339869281,
			}),
			E01000002: record("E01000002", "Publisher name"),
		});
		const hash = createHash("sha256").update(text).digest("hex");
		try {
			writeSqliteIndex(
				path,
				{ schemaVersion: "3" },
				{
					...areaFixture(),
					payloads: {
						columns: ["id TEXT", "payload TEXT"],
						key: ["id"],
						rows: [["dataset:fuel-poverty", text]],
					},
					datasets: {
						columns: [
							"type TEXT",
							"output TEXT",
							"sha256 TEXT",
							"payloadId TEXT",
						],
						key: ["type"],
						rows: [
							[
								"fuelPoverty",
								"fuel-poverty",
								hash,
								"dataset:fuel-poverty",
							],
						],
					},
					...statisticsTables([fuelPovertyStatistics(text, entry)]),
				},
			);
			const database = new DatabaseSync(path);
			try {
				expect(rebuildFuelPoverty(database)).toBe(text);
				expect(
					database
						.prepare("SELECT count(*) AS n FROM observation")
						.get()?.n,
				).toBe(6);
				// Only the name that differs from the boundary name is stored.
				expect(
					database
						.prepare(
							"SELECT area_version_id, name FROM dataset_area_name",
						)
						.all(),
				).toEqual([{ area_version_id: 2, name: "Publisher name" }]);
				expect(
					database
						.prepare(
							"SELECT measure, area_code, area_name, period, value, status FROM v_observation WHERE area_code = 'E01000001' ORDER BY measure",
						)
						.all(),
				).toEqual([
					{
						measure: "fuel-poor-households",
						area_code: "E01000001",
						area_name: "City of London 001A",
						period: "2024",
						value: 42,
						status: "observed",
					},
					{
						measure: "fuel-poverty-rate",
						area_code: "E01000001",
						area_name: "City of London 001A",
						period: "2024",
						value: 4.57516339869281,
						status: "observed",
					},
					{
						measure: "households",
						area_code: "E01000001",
						area_name: "City of London 001A",
						period: "2024",
						value: 918,
						status: "observed",
					},
				]);
				const strict = database
					.prepare(
						"SELECT name, strict FROM pragma_table_list WHERE name IN ('source','dataset','measure','dimension','dimension_member','period','status','series','series_member','dataset_area_name','observation')",
					)
					.all();
				expect(strict).toHaveLength(11);
				expect(strict.every((row) => row.strict === 1)).toBe(true);
				expect(
					database
						.prepare(
							"SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('observation_area', 'series_dataset', 'series_member_member') ORDER BY name",
						)
						.all()
						.map((row) => row.name),
				).toEqual([
					"observation_area",
					"series_dataset",
					"series_member_member",
				]);
				expect(
					database.prepare("PRAGMA foreign_key_check").all(),
				).toEqual([]);
				database.exec("UPDATE payloads SET payload = 'unused'");
			} finally {
				database.close();
			}
			expect(readVersionedAtlasDataset(root, "fuel-poverty", hash)).toBe(
				text,
			);
			expect(
				readVersionedAtlasDataset(root, "fuel-poverty", "stale"),
			).toBeUndefined();
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it.each([
		[
			"an unknown area",
			{ E01000009: record("E01000009", "Name") },
			/Unknown area E01000009/,
		],
		[
			"a mismatched record code",
			{ E01000001: record("E01000002", "Name") },
			/Unknown fuel poverty area/,
		],
		[
			"a missing value",
			{
				E01000001: {
					lsoaCode: "E01000001",
					lsoaName: "Name",
					householdCount: 1,
					fuelPoorHouseholdCount: 0,
				},
			},
			/Invalid fuel poverty value/,
		],
		[
			"records out of code order",
			{
				E01000002: record("E01000002", "B"),
				E01000001: record("E01000001", "A"),
			},
			/not in area code order/,
		],
	])("refuses %s instead of publishing incomplete rows", (_, data, error) => {
		expect(() => {
			const database = memory(
				statisticsTables([
					fuelPovertyStatistics(fuelPovertyText(data), entry),
				]),
			);
			database.close();
		}).toThrow(error);
	});
});

describe("statistics model is generic", () => {
	const source = { publisher: "ONS", licence: "OGL v3.0" };
	const households = {
		slug: "households",
		label: "Households",
		description: "Number of households.",
		unit: "households",
		valueKind: "count" as const,
		aggregation: "sum" as const,
	};
	const local = { geography: "localAuthority", id: "2024-05-uk-bgc" };

	/** A census cube: one measure split by a dimension, as a mapper would write it. */
	const tenure: StatisticsDataset = {
		slug: "census-tenure",
		title: "Tenure",
		description: "Households by tenure.",
		source,
		fingerprint: "fixture",
		measures: [households],
		dimensions: [
			{
				slug: "tenure",
				label: "Tenure",
				members: [
					{ code: "total", label: "All households" },
					{ code: "owned", label: "Owned", parent: "total" },
					{ code: "rented", label: "Rented", parent: "total" },
				],
			},
		],
		periods: [
			{
				label: "2021-census",
				kind: "date",
				start: "2021-03-21",
				end: "2021-03-21",
			},
		],
		series: ["total", "owned", "rented"].map((member) => ({
			measure: "households",
			release: local,
			members: { tenure: member },
		})),
		*observations() {
			yield {
				series: 0,
				code: "E09000001",
				period: "2021-census",
				value: 10,
			};
			yield {
				series: 1,
				code: "E09000001",
				period: "2021-census",
				value: 4,
			};
			yield {
				series: 2,
				code: "E09000001",
				period: "2021-census",
				value: 6,
			};
		},
	};

	/** Crime counts by type, with one suppressed value and a categorical measure. */
	const crime: StatisticsDataset = {
		slug: "crime",
		title: "Crime",
		description: "Recorded crime.",
		source: { publisher: "Home Office", licence: "OGL v3.0" },
		fingerprint: "fixture",
		measures: [
			{
				slug: "crime-count",
				label: "Crimes",
				description: "Recorded crimes.",
				unit: "crimes",
				valueKind: "count",
				aggregation: "sum",
			},
			{
				slug: "most-common-crime",
				label: "Most common crime",
				description: "Crime type with the most records.",
				unit: "category",
				valueKind: "category",
				aggregation: "none",
			},
		],
		dimensions: [
			{
				slug: "crime-type",
				label: "Crime type",
				members: [
					{ code: "burglary", label: "Burglary" },
					{ code: "robbery", label: "Robbery" },
				],
			},
		],
		categoryDimension: "crime-type",
		periods: [
			{
				label: "2024",
				kind: "year",
				start: "2024-01-01",
				end: "2024-12-31",
			},
		],
		series: [
			{
				measure: "crime-count",
				release: local,
				members: { "crime-type": "burglary" },
			},
			{
				measure: "crime-count",
				release: local,
				members: { "crime-type": "robbery" },
			},
			{ measure: "most-common-crime", release: local },
		],
		*observations() {
			yield { series: 0, code: "E09000002", period: "2024", value: 120 };
			yield {
				series: 1,
				code: "E09000002",
				period: "2024",
				value: null,
				status: "suppressed",
			};
			yield {
				series: 2,
				code: "E09000002",
				period: "2024",
				value: null,
				category: "burglary",
			};
		},
	};

	it("stores a census cube and crime counts through mappers alone", () => {
		const fuel = fuelPovertyStatistics(
			fuelPovertyText({
				E01000001: record("E01000001", "City of London 001A"),
			}),
			entry,
		);
		const database = memory(statisticsTables([fuel, tenure, crime]));
		try {
			// `households` is one measure shared by fuel poverty and the census.
			expect(
				database
					.prepare(
						"SELECT count(*) AS n FROM measure WHERE slug = 'households'",
					)
					.get()?.n,
			).toBe(1);
			expect(
				database
					.prepare(
						"SELECT dataset, members, value FROM v_observation WHERE measure = 'households' AND geography = 'localAuthority' ORDER BY value",
					)
					.all(),
			).toEqual([
				{ dataset: "census-tenure", members: "tenure=owned", value: 4 },
				{
					dataset: "census-tenure",
					members: "tenure=rented",
					value: 6,
				},
				{
					dataset: "census-tenure",
					members: "tenure=total",
					value: 10,
				},
			]);
			expect(
				database
					.prepare(
						"SELECT measure, members, value, category, status FROM v_observation WHERE dataset = 'crime' ORDER BY measure, members",
					)
					.all(),
			).toEqual([
				{
					measure: "crime-count",
					members: "crime-type=burglary",
					value: 120,
					category: null,
					status: "observed",
				},
				{
					measure: "crime-count",
					members: "crime-type=robbery",
					value: null,
					category: null,
					status: "suppressed",
				},
				{
					measure: "most-common-crime",
					members: null,
					value: null,
					category: "burglary",
					status: "observed",
				},
			]);
			expect(rebuildFuelPoverty(database)).toContain(
				"City of London 001A",
			);
			expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual(
				[],
			);
		} finally {
			database.close();
		}
	});

	it("refuses a measure declared differently by two datasets", () => {
		expect(() =>
			memory(
				statisticsTables([
					tenure,
					{
						...crime,
						measures: [{ ...households, unit: "dwellings" }],
						series: [],
					},
				]),
			),
		).toThrow(/Conflicting measure households/);
	});

	it("refuses an observed value that is missing", () => {
		expect(() =>
			memory(
				statisticsTables([
					{
						...crime,
						*observations() {
							yield {
								series: 0,
								code: "E09000002",
								period: "2024",
								value: null,
							};
						},
					},
				]),
			),
		).toThrow(/CHECK constraint failed/);
	});

	it("refuses an area outside the series' release", () => {
		expect(() =>
			memory(
				statisticsTables([
					{
						...crime,
						*observations() {
							yield {
								series: 0,
								code: "E01000001",
								period: "2024",
								value: 1,
							};
						},
					},
				]),
			),
		).toThrow(/Unknown area E01000001 in localAuthority/);
	});
});
