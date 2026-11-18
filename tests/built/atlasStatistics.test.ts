import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";

import { execFileSync } from "node:child_process";

import { buildAreaInventory } from "../../pipeline/src/geographies/buildAreaInventory";
import { buildAtlasSqlite } from "../../pipeline/src/atlas/buildAtlasSqlite";
import { sha256Hex } from "../../pipeline/src/lib/hash";
import { directPayloadProblem } from "../../pipeline/src/checks/directPayloadGoldens";
import { readDirectParts } from "../../pipeline/src/statistics/directSources";
import { buildTerrainCatalogue } from "../../pipeline/src/catalog/buildTerrainCatalogue";
import {
	readVersionedAtlasDataset,
	rebuildDatasetPayload,
} from "@uk-data-atlas/catalogue/node";

import { artifactDirectory } from "@uk-data-atlas/atlas-db";

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

it("builds and serves every real fuel poverty value byte for byte from its source and measures their size", async () => {
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
		import { compileDirectDataset } from './pipeline/src/precompile/compileDirectDataset.ts';
		import { definitionOf, fuelPoverty } from '@uk-data-atlas/datasets';
		const entry = await compileDirectDataset(definitionOf(fuelPoverty), undefined);
		process.stdout.write('MANIFEST_ENTRY=' + JSON.stringify(entry));
	`,
		],
		{ encoding: "utf8" },
	);
	const entry: {
		inputs: { path: string }[];
		direct: true;
		compiled: { sha256: string; bytes: number };
	} = JSON.parse(compiled.split("MANIFEST_ENTRY=")[1]);
	// No compiled file: the source is read straight into rows.
	const direct = await readDirectParts(() => entry, ["fuel-poverty"]);
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
		mkdirSync(join(output, "geography"), { recursive: true });
		write(join(output, "geography/boundary-releases.json"), {
			schemaVersion: 1,
			contentHash: "fixture",
			releases: [],
		});
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
		const path = buildAtlasSqlite(root, { censusTables: [], direct });
		symlinkSync("atlas-base.sqlite", join(output, "atlas.sqlite"));
		const database = new DatabaseSync(path);
		try {
			const text = rebuildDatasetPayload(
				database,
				"fuel-poverty",
				"fuel-poverty",
			);
			expect(directPayloadProblem("fuel-poverty", text)).toBeUndefined();
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
					sha256Hex(text),
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
			database.exec(
				`PRAGMA foreign_keys = OFF; DROP VIEW v_observation; ${statisticsTableNames
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
