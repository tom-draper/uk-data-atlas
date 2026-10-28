import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { catalogueObservationTables } from "../../services/api/src/catalogueObservationTables";
import {
	writeSqliteIndex,
	writeSqliteTables,
} from "../../services/api/src/sqliteIndex";
import { rebuildFuelPoverty } from "@uk-data-atlas/atlas-runtime/catalogue";
import { readVersionedAtlasDataset } from "@uk-data-atlas/atlas-runtime/storage";

it("reconstructs numeric catalogue rows exactly and serves them without the retained blob", () => {
	const root = mkdtempSync(join(tmpdir(), "catalogue-rows-"));
	const path = join(root, "data/build/atlas.sqlite");
	mkdirSync(join(root, "data/build"), { recursive: true });
	const text = JSON.stringify({
		2024: {
			id: "fuelPoverty2024",
			type: "fuelPoverty",
			year: 2024,
			boundaryType: "lsoa",
			boundaryYear: 2021,
			data: {
				E01000002: {
					lsoaCode: "E01000002",
					lsoaName: "Publisher name",
					householdCount: 100,
					fuelPoorHouseholdCount: 0,
					fuelPovertyRate: 0,
				},
				E01000001: {
					lsoaCode: "E01000001",
					lsoaName: "Other",
					householdCount: 200,
					fuelPoorHouseholdCount: 25,
					fuelPovertyRate: 12.5,
				},
			},
		},
	});
	const hash = createHash("sha256").update(text).digest("hex");
	try {
		writeSqliteIndex(
			path,
			{ schemaVersion: "2" },
			{
				area_releases: {
					columns: [
						"position INTEGER UNIQUE",
						"geography TEXT",
						"id TEXT",
					],
					key: ["position"],
					rows: [[0, "lsoa", "2021-12-ew-bgc-v5"]],
				},
				areas: {
					columns: [
						"id INTEGER",
						"releasePosition INTEGER",
						"code TEXT",
					],
					key: ["id"],
					rows: [
						[1, 0, "E01000001"],
						[2, 0, "E01000002"],
					],
				},
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
				...catalogueObservationTables(text),
			},
		);
		const database = new DatabaseSync(path);
		try {
			expect(rebuildFuelPoverty(database)).toBe(text);
			expect(
				database
					.prepare("SELECT count(*) AS n FROM catalogue_observations")
					.get()?.n,
			).toBe(6);
			expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual(
				[],
			);
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
		"unknown area",
		{
			lsoaCode: "E01000002",
			lsoaName: "Name",
			householdCount: 1,
			fuelPoorHouseholdCount: 0,
			fuelPovertyRate: 0,
		},
		/Unknown fuel poverty area/,
	],
	[
		"missing value",
		{
			lsoaCode: "E01000001",
			lsoaName: "Name",
			householdCount: 1,
			fuelPoorHouseholdCount: 0,
		},
		/Invalid fuel poverty value/,
	],
])(
	"refuses %s instead of publishing incomplete rows",
	(_label, record, error) => {
		const database = new DatabaseSync(":memory:");
		try {
			database.exec(
				"CREATE TABLE datasets(type TEXT PRIMARY KEY); INSERT INTO datasets VALUES ('fuelPoverty'); CREATE TABLE area_releases(position INTEGER, geography TEXT, id TEXT); INSERT INTO area_releases VALUES (0, 'lsoa', '2021-12-ew-bgc-v5'); CREATE TABLE areas(id INTEGER PRIMARY KEY, releasePosition INTEGER, code TEXT); INSERT INTO areas VALUES (1, 0, 'E01000001');",
			);
			const text = JSON.stringify({
				2024: {
					id: "fuelPoverty2024",
					type: "fuelPoverty",
					year: 2024,
					boundaryType: "lsoa",
					boundaryYear: 2021,
					data: { [record.lsoaCode]: record },
				},
			});
			expect(() =>
				writeSqliteTables(database, catalogueObservationTables(text)),
			).toThrow(error);
		} finally {
			database.close();
		}
	},
);
