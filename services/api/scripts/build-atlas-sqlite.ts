import { namedLocationTables } from "../src/atlasNamedLocations";
import { crosswalkTables } from "../src/atlasCrosswalks";
import { areaTables } from "../src/atlasAreas";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeSqliteIndex } from "../src/sqliteIndex";

export const buildAtlasSqlite = (repositoryRoot: string) => {
	const directory = join(repositoryRoot, "data/build");
	mkdirSync(directory, { recursive: true });
	const path = join(directory, "atlas.sqlite");
	const payload = readFileSync(
		join(repositoryRoot, "services/api/public/terrain-catalogue.json"),
		"utf8",
	);
	const manifestPayload = readFileSync(
		join(directory, "datasets/dataset-manifest.json"),
		"utf8",
	);
	const manifest = JSON.parse(manifestPayload) as {
		datasets: {
			type: string;
			output: string;
			source: unknown;
			contract: unknown;
			summary: unknown;
			fingerprint: string;
			compiled: { sha256: string; bytes: number };
		}[];
	};
	function* payloads() {
		yield ["terrain-catalogue", payload];
		yield ["dataset-manifest", manifestPayload];
		for (const entry of manifest.datasets) {
			const content = readFileSync(
				join(directory, "datasets", `${entry.output}.json`),
				"utf8",
			);
			if (
				Buffer.byteLength(content) !== entry.compiled.bytes ||
				createHash("sha256").update(content).digest("hex") !==
					entry.compiled.sha256
			)
				throw new Error(
					`Compiled dataset ${entry.output} does not match its manifest`,
				);
			yield [`dataset:${entry.output}`, content];
		}
	}
	writeSqliteIndex(
		path,
		{ schemaVersion: "1" },
		{
			...areaTables(join(repositoryRoot, "services/api/public")),
			...crosswalkTables(join(repositoryRoot, "services/api/public")),
			...namedLocationTables(join(repositoryRoot, "services/api/public")),
			payloads: {
				columns: ["id TEXT NOT NULL", "payload TEXT NOT NULL"],
				key: ["id"],
				rows: payloads(),
			},
			datasets: {
				columns: [
					"type TEXT NOT NULL",
					"output TEXT NOT NULL UNIQUE",
					"source TEXT NOT NULL",
					"contract TEXT NOT NULL",
					"summary TEXT NOT NULL",
					"fingerprint TEXT NOT NULL",
					"sha256 TEXT NOT NULL",
					"bytes INTEGER NOT NULL",
					"payloadId TEXT NOT NULL REFERENCES payloads(id)",
				],
				key: ["type"],
				rows: manifest.datasets.map((entry) => [
					entry.type,
					entry.output,
					JSON.stringify(entry.source),
					JSON.stringify(entry.contract),
					JSON.stringify(entry.summary),
					entry.fingerprint,
					entry.compiled.sha256,
					entry.compiled.bytes,
					`dataset:${entry.output}`,
				]),
			},
		},
	);
	return path;
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const path = buildAtlasSqlite(resolve(dirname(scriptPath), "../../.."));
	console.log(`Wrote shared atlas database to ${path}`);
}
