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

it("builds and serves every real fuel poverty value byte for byte and measures pilot storage", () => {
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
		join(repositoryRoot, "data/build/observation-pilot-"),
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
				database
					.prepare("SELECT count(*) AS n FROM catalogue_observations")
					.get()?.n,
			).toBe(33755 * 3);
			expect(
				database
					.prepare(
						"SELECT value FROM meta WHERE key = 'schemaVersion'",
					)
					.get()?.value,
			).toBe("2");
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
			const after = statSync(path).size;
			database.exec(
				"DROP TABLE catalogue_observations; DROP TABLE catalogue_records; DROP TABLE catalogue_periods; DROP TABLE catalogue_measures; UPDATE meta SET value = '1' WHERE key = 'schemaVersion'; VACUUM;",
			);
			const before = statSync(path).size;
			expect(after).toBeGreaterThan(before);
			writeFileSync(
				"data/build/catalogue-observation-pilot.json",
				JSON.stringify({
					scope: "pilot database, real LSOAs and fuel poverty, empty unrelated inventories",
					before,
					after,
					delta: after - before,
					observations: 33755 * 3,
					payloadBytes: Buffer.byteLength(text),
				}),
			);
		} finally {
			database.close();
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);
