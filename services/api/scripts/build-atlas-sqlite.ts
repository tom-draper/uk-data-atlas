import {
	locationProjectionTables,
	type LocationProjectionInventory,
	type LocationProjectionArtifact,
	type LocationParentProjectionArtifact,
} from "../src/locationProjections";
import { readStoredText } from "../src/storedText";
import { namedLocationTables } from "../src/atlasNamedLocations";
import { crosswalkTables } from "../src/atlasCrosswalks";
import { areaTables } from "../src/atlasAreas";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
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
	const publicDirectory = join(repositoryRoot, "services/api/public");
	const projectionPayload = readFileSync(
		join(publicDirectory, "location-projection-inventory.json"),
		"utf8",
	);
	const projectionInventory: LocationProjectionInventory =
		JSON.parse(projectionPayload);
	if (
		projectionInventory.schemaVersion !== 1 ||
		!Array.isArray(projectionInventory.shards) ||
		!Array.isArray(projectionInventory.parentShards)
	)
		throw new Error(
			"Invalid location projection inventory before SQLite build.",
		);
	const readProjectionArtifact = (
		shard: LocationProjectionInventory["shards"][number],
	) => {
		const text = readStoredText(join(publicDirectory, shard.artifact));
		const artifact:
			LocationProjectionArtifact | LocationParentProjectionArtifact =
			JSON.parse(text);
		if (
			artifact.schemaVersion !== 1 ||
			artifact.crosswalkId !== shard.crosswalkId ||
			artifact.contentHash !== shard.contentHash ||
			artifact.namedLocationInventoryHash !==
				projectionInventory.namedLocationInventoryHash ||
			artifact.crosswalkInventoryHash !==
				projectionInventory.crosswalkInventoryHash
		)
			throw new Error(
				`Location projection ${shard.artifact} does not match its inventory.`,
			);
		return artifact;
	};
	const artifacts = projectionInventory.shards.map((shard) => {
		const artifact = readProjectionArtifact(shard);
		if (
			!("projections" in artifact) ||
			!Array.isArray(artifact.projections) ||
			artifact.projections.length !== shard.recordCount
		)
			throw new Error(`Invalid member projections in ${shard.artifact}`);
		return artifact;
	});
	const parentArtifacts = projectionInventory.parentShards.map((shard) => {
		const artifact = readProjectionArtifact(shard);
		if (
			!("parentProjections" in artifact) ||
			!Array.isArray(artifact.parentProjections) ||
			artifact.parentProjections.length !== shard.recordCount
		)
			throw new Error(`Invalid parent projections in ${shard.artifact}`);
		return artifact;
	});
	function* payloads() {
		yield ["terrain-catalogue", payload];
		yield ["dataset-manifest", manifestPayload];
		yield ["location-projection-inventory", projectionPayload];
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
			...locationProjectionTables({ artifacts, parentArtifacts }),
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
	rmSync(join(publicDirectory, "location-projections.sqlite"), {
		force: true,
	});
	return path;
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const path = buildAtlasSqlite(resolve(dirname(scriptPath), "../../.."));
	console.log(`Wrote shared atlas database to ${path}`);
}
