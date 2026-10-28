import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { atlasCachePath, publishAtlasCache } from "../storage/atlasCache";
import { rebuildFromLayout } from "./datasetLayout";
import { rebuildFuelPoverty } from "./fuelPovertyStatistics";
import { STATISTICS_DATASETS } from "./statisticsDatasets";

const declared = new Map(
	STATISTICS_DATASETS.map((config) => [config.type, config]),
);

/** Whether a manifest type's JSON is rebuilt from rows instead of stored. */
export const servedFromRows = (type: string) =>
	type === "fuelPoverty" || declared.get(type)?.rebuild !== undefined;

/** A dataset's compiled JSON, rebuilt from the canonical rows. */
export function rebuildDatasetPayload(
	database: DatabaseSync,
	type: string,
	output: string,
): string {
	if (type === "fuelPoverty") return rebuildFuelPoverty(database);
	const rebuild = declared.get(type)?.rebuild;
	if (!rebuild) throw new Error(`Dataset ${output} is not served from rows`);
	return rebuildFromLayout(database, output, rebuild.derived);
}

const digest = (text: string) =>
	createHash("sha256").update(text).digest("hex");

const readCached = (root: string, output: string, sha256: string) => {
	const path = atlasCachePath(root);
	if (!existsSync(path)) return undefined;
	const cache = new DatabaseSync(path, { readOnly: true });
	try {
		const row = cache
			.prepare(
				"SELECT payload FROM dataset_payloads WHERE output = ? AND sha256 = ?",
			)
			.get(output, sha256);
		return typeof row?.payload === "string" ? row.payload : undefined;
	} catch {
		// A cache from before dataset payloads moved has no table yet.
		return undefined;
	} finally {
		cache.close();
	}
};

/**
 * A compiled dataset by output name: the stored payload, or for datasets
 * served from rows the cached rebuild, rebuilding from rows when the cache
 * lacks it. Undefined when the output is unknown or `sha256` is not current.
 */
export function readDatasetPayload(
	root: string,
	output: string,
	sha256?: string,
): string | undefined {
	const path = join(root, "data/build/atlas.sqlite");
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		const row = database
			.prepare(
				"SELECT type, sha256, payloadId FROM datasets WHERE output = ?",
			)
			.get(output);
		if (!row || (sha256 !== undefined && row.sha256 !== sha256))
			return undefined;
		if (typeof row.payloadId === "string") {
			const stored = database
				.prepare("SELECT payload FROM payloads WHERE id = ?")
				.get(row.payloadId)?.payload;
			if (typeof stored !== "string")
				throw new Error(`Missing payload ${row.payloadId} at ${path}`);
			return stored;
		}
		const current = String(row.sha256);
		const cached = readCached(root, output, current);
		if (cached !== undefined) return cached;
		const rebuilt = rebuildDatasetPayload(
			database,
			String(row.type),
			output,
		);
		if (digest(rebuilt) !== current)
			throw new Error(
				`Rows for ${output} do not match its manifest hash`,
			);
		return rebuilt;
	} finally {
		database.close();
	}
}

/** Rebuild every dataset served from rows into the cache, checking each hash. */
export function publishDatasetPayloads(root: string) {
	return publishAtlasCache(root, "datasets", (cache) => {
		cache.exec(
			"DROP TABLE IF EXISTS dataset_payloads; CREATE TABLE dataset_payloads (output TEXT NOT NULL PRIMARY KEY, sha256 TEXT NOT NULL, payload TEXT NOT NULL) STRICT, WITHOUT ROWID",
		);
		const insert = cache.prepare(
			"INSERT INTO dataset_payloads VALUES (?, ?, ?)",
		);
		const database = new DatabaseSync(
			join(root, "data/build/atlas.sqlite"),
			{ readOnly: true },
		);
		try {
			for (const row of database
				.prepare(
					"SELECT type, output, sha256, bytes FROM datasets WHERE payloadId IS NULL ORDER BY output",
				)
				.all()) {
				const output = String(row.output);
				const payload = rebuildDatasetPayload(
					database,
					String(row.type),
					output,
				);
				if (
					digest(payload) !== row.sha256 ||
					Buffer.byteLength(payload) !== row.bytes
				)
					throw new Error(
						`Rows for ${output} do not match its manifest hash`,
					);
				insert.run(output, row.sha256, payload);
			}
		} finally {
			database.close();
		}
	});
}
