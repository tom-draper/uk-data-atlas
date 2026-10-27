import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";

import { execFileSync } from "node:child_process";

import { buildAreaInventory } from "../../pipeline/src/build-area-inventory";
import { buildAtlasSqlite } from "../../pipeline/src/buildAtlasSqlite";
import { buildTerrainCatalogue } from "../../pipeline/src/build-terrain-catalogue";
import { rebuildFuelPoverty } from "@uk-data-atlas/atlas-runtime/catalogue";
import { readVersionedAtlasDataset } from "@uk-data-atlas/atlas-runtime/storage";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";

/** In drop order: children before the tables they reference. */
const statisticsTableNames = [
	"observation",
	"dataset_area_name",
	"series_member",
	"series",
	"status",
	"period",
	"dimension_member",
	"dimension",
	"measure",
	"dataset",
	"source",
];

it("builds and serves every real fuel poverty value byte for byte from statistics rows and measures their size", () => {
	const repositoryRoot = process.cwd();
	mkdirSync("data/build/datasets", { recursive: true });
	const compiled = execFileSync(
		process.execPath,
		[
			"--import",
			"tsx",
			"--input-type=module",
			"-e",
			`
		import { compileDataset } from './pipeline/src/precompile/compileDataset.mts';
		import { fuelPovertyDatasetDefinition } from '@uk-data-atlas/datasets/data/catalog/definitions/fuelPoverty';
		const entry = await compileDataset(fuelPovertyDatasetDefinition, new Map());
		process.stdout.write('MANIFEST_ENTRY=' + JSON.stringify(entry));
	`,
		],
		{ encoding: "utf8" },
	);
	const entry: { compiled: { sha256: string; bytes: number } } = JSON.parse(
		compiled.split("MANIFEST_ENTRY=")[1],
	);
	const text = readFileSync("data/build/datasets/fuel-poverty.json", "utf8");
	mkdirSync(artifactDirectory(repositoryRoot), { recursive: true });
	buildAreaInventory(repositoryRoot);
	// Unrelated inventories are empty fixtures; dataset and LSOA inputs use the real compilers.
	const root = mkdtempSync(
		join(repositoryRoot, "data/build/statistics-pilot-"),
	);
	const publicRoot = artifactDirectory(root);
	const output = join(root, "data/build");
	const write = (path: string, value: unknown) =>
		writeFileSync(path, JSON.stringify(value));
	try {
		mkdirSync(publicRoot, { recursive: true });
		mkdirSync(join(output, "datasets"), { recursive: true });
		mkdirSync(join(output, "location-projections"), { recursive: true });
		buildTerrainCatalogue(root);
		cpSync(
			join(artifactDirectory(repositoryRoot), "areas"),
			join(publicRoot, "areas"),
			{
				recursive: true,
			},
		);
		cpSync(
			join(artifactDirectory(repositoryRoot), "area-inventory.json"),
			join(publicRoot, "area-inventory.json"),
		);
		write(join(publicRoot, "crosswalk-inventory.json"), {
			schemaVersion: 1,
			contentHash: "fixture",
			crosswalks: [],
		});
		write(join(publicRoot, "named-locations.json"), {
			schemaVersion: 1,
			contentHash: "fixture",
			source: { artifact: "fixture", gazetteerVersion: 1 },
			locations: [],
		});
		write(
			join(
				output,
				"location-projections/location-projection-inventory.json",
			),
			{
				schemaVersion: 1,
				contentHash: "fixture",
				shards: [],
				parentShards: [],
			},
		);
		write(join(output, "datasets/dataset-manifest.json"), {
			version: 1,
			datasets: [{ ...entry, fingerprint: entry.compiled.sha256 }],
		});
		writeFileSync(join(output, "datasets/fuel-poverty.json"), text);
		const path = buildAtlasSqlite(root);
		const database = new DatabaseSync(path);
		try {
			expect(rebuildFuelPoverty(database)).toBe(text);
			expect(
				database.prepare("SELECT count(*) AS n FROM observation").get()
					?.n,
			).toBe(33755 * 3);
			expect(
				database
					.prepare(
						"SELECT value FROM meta WHERE key = 'schemaVersion'",
					)
					.get()?.value,
			).toBe("3");
			expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual(
				[],
			);
			expect(
				readVersionedAtlasDataset(
					root,
					"fuel-poverty",
					entry.compiled.sha256,
				),
			).toBe(text);
			const publisherNames = Number(
				database
					.prepare("SELECT count(*) AS n FROM dataset_area_name")
					.get()?.n,
			);
			// Per table and index, where this SQLite build has dbstat.
			let tableBytes: Record<string, number> | null = null;
			try {
				tableBytes = Object.fromEntries(
					database
						.prepare(
							`SELECT d.name, sum(d.pgsize) AS bytes FROM dbstat d JOIN sqlite_master m ON m.name = d.name WHERE m.tbl_name IN (${statisticsTableNames.map((table) => `'${table}'`).join(", ")}) GROUP BY d.name ORDER BY bytes DESC`,
						)
						.all()
						.map((row) => [String(row.name), Number(row.bytes)]),
				);
			} catch {
				// dbstat is a compile-time option; totals below still apply.
			}
			const after = statSync(path).size;
			database.exec("DROP INDEX observation_area; VACUUM;");
			const withoutAreaIndex = statSync(path).size;
			database.exec(
				`DROP VIEW v_observation; ${statisticsTableNames
					.map((table) => `DROP TABLE ${table};`)
					.join(" ")} VACUUM;`,
			);
			const before = statSync(path).size;
			expect(after).toBeGreaterThan(before);
			writeFileSync(
				"data/build/statistics-pilot.json",
				JSON.stringify({
					scope: "pilot database, real LSOAs and fuel poverty, empty unrelated inventories",
					before,
					after,
					delta: after - before,
					areaIndexBytes: after - withoutAreaIndex,
					observations: 33755 * 3,
					bytesPerObservation: (after - before) / (33755 * 3),
					publisherNames,
					tableBytes,
					payloadBytes: Buffer.byteLength(text),
				}),
			);
		} finally {
			database.close();
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 600_000);
