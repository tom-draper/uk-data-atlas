import { statisticsTables } from "@uk-data-atlas/atlas-runtime/catalogue";
import { fuelPovertyStatistics } from "@uk-data-atlas/atlas-runtime/catalogue";
import { publishAtlasCache } from "@uk-data-atlas/atlas-runtime/storage";
import {
	writeSqliteIndex,
	writeSqliteTables,
} from "@uk-data-atlas/atlas-runtime/storage";
import {
	locationProjectionTables,
	type LocationProjectionInventory,
	type LocationProjectionArtifact,
	type LocationParentProjectionArtifact,
} from "@uk-data-atlas/atlas-runtime/places";
import { readStoredText } from "@uk-data-atlas/artifacts";
import { namedLocationTables } from "@uk-data-atlas/atlas-runtime/storage";
import { crosswalkTables } from "@uk-data-atlas/atlas-runtime/storage";
import { areaTables } from "@uk-data-atlas/atlas-runtime/storage";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";

export const buildAtlasSqlite = (repositoryRoot: string) => {
	const directory = join(repositoryRoot, "data/build");
	mkdirSync(directory, { recursive: true });
	const path = join(directory, "atlas.sqlite");
	const payload = readFileSync(
		join(artifactDirectory(repositoryRoot), "terrain-catalogue.json"),
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
	const publicDirectory = artifactDirectory(repositoryRoot);
	const projectionDirectory = join(directory, "location-projections");
	const projectionPayload = readFileSync(
		join(projectionDirectory, "location-projection-inventory.json"),
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
		const text = readStoredText(join(projectionDirectory, shard.artifact));
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
		{ schemaVersion: "3" },
		{
			...areaTables(artifactDirectory(repositoryRoot)),
			...crosswalkTables(artifactDirectory(repositoryRoot)),
			...namedLocationTables(artifactDirectory(repositoryRoot)),
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
			...statisticsTables(
				manifest.datasets
					.filter((entry) => entry.type === "fuelPoverty")
					.map((entry) =>
						fuelPovertyStatistics(
							readFileSync(
								join(
									directory,
									`datasets/${entry.output}.json`,
								),
								"utf8",
							),
							entry,
						),
					),
			),
		},
	);
	publishAtlasCache(repositoryRoot, "projections", (database) => {
		const tables = locationProjectionTables({ artifacts, parentArtifacts });
		for (const name of Object.keys(tables))
			database.exec(`DROP TABLE IF EXISTS ${name}`);
		writeSqliteTables(database, tables);
		database
			.prepare("INSERT OR REPLACE INTO payloads VALUES (?, ?)")
			.run("location-projection-inventory", projectionPayload);
	});

	rmSync(join(publicDirectory, "location-projections.sqlite"), {
		force: true,
	});
	return path;
};
