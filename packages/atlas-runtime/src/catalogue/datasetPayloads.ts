import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { atlasCachePath } from "../storage/atlasCache.ts";
import {
	openReadOnlyDatabase,
	type SqlReader,
} from "../storage/readOnlyDatabase.ts";
import { rebuildFromDeclaration } from "./declaredPayload.ts";
import type { Json } from "./declaredStatistics.ts";
import { rebuildFuelPoverty } from "./fuelPovertyStatistics.ts";
import { STATISTICS_DATASETS } from "./statisticsDatasets/index.ts";

const declared = new Map(
	STATISTICS_DATASETS.map((config) => [config.type, config]),
);

/** Whether a manifest type's JSON is rebuilt from rows instead of stored. */
export const servedFromRows = (type: string) =>
	type === "fuelPoverty" || declared.get(type)?.payload !== undefined;

/** Datasets that derived rules have read, once per database. */
const others = new WeakMap<
	SqlReader,
	Map<string, { readonly [key: string]: Json }>
>();

/** Whether a dataset's JSON is generated from rows, with no layout tables. */
export const generatedFromRows = (type: string) =>
	declared.get(type)?.payload !== undefined;

/**
 * A compiled dataset's parts without the header fields its declaration says
 * the generated payload drops, so the two compare by what rows can say.
 */
export function comparableCompiled(type: string, compiled: unknown): unknown {
	const dropped = declared.get(type)?.payload?.dropped ?? [];
	if (!dropped.length) return compiled;
	return Object.fromEntries(
		Object.entries(compiled as Record<string, Record<string, unknown>>).map(
			([key, part]) => [
				key,
				Object.fromEntries(
					Object.entries(part).filter(
						([field]) => !dropped.includes(field),
					),
				),
			],
		),
	);
}

/** A dataset's compiled JSON, rebuilt from the canonical rows. */
export function rebuildDatasetPayload(
	database: SqlReader,
	type: string,
	output: string,
): string {
	if (type === "fuelPoverty") return rebuildFuelPoverty(database);
	const config = declared.get(type);
	if (config?.payload)
		return rebuildFromDeclaration(database, config, output, (other) => {
			let read = others.get(database);
			if (!read) others.set(database, (read = new Map()));
			let found = read.get(other);
			if (!found) {
				const type = database
					.prepare("SELECT type FROM datasets WHERE output = ?")
					.get(other)?.type;
				if (typeof type !== "string")
					throw new Error(`Unknown dataset ${other}`);
				read.set(
					other,
					(found = JSON.parse(
						rebuildDatasetPayload(database, type, other),
					)),
				);
			}
			return found!;
		});
	throw new Error(`Dataset ${output} is not served from rows`);
}

const digest = (text: string) =>
	createHash("sha256").update(text).digest("hex");

/** A cached payload as stored: gzipped JSON, with the generated hash. */
export type StoredDatasetPayload = {
	/** The hash of the JSON, once decompressed. */
	sha256: string;
	/** The size of the JSON, once decompressed. */
	bytes: number;
	gzip: Uint8Array;
};

const readCached = (
	root: string,
	output: string,
	sourceSha256: string,
): StoredDatasetPayload | undefined => {
	const path = atlasCachePath(root);
	if (!existsSync(path)) return undefined;
	const cache = openReadOnlyDatabase(path);
	try {
		const row = cache
			.prepare(
				"SELECT sha256, bytes, gzip FROM dataset_payloads WHERE output = ? AND source_sha256 = ?",
			)
			.get(output, sourceSha256);
		return typeof row?.sha256 === "string" &&
			typeof row.bytes === "number" &&
			row.gzip instanceof Uint8Array
			? { sha256: row.sha256, bytes: row.bytes, gzip: row.gzip }
			: undefined;
	} catch {
		// A cache from before payloads were stored gzipped has no such column.
		return undefined;
	} finally {
		cache.release();
	}
};

/**
 * A dataset's gzipped cache entry for the URL hash `sha256`, for serving as
 * is. Undefined when the dataset is not cached, or `sha256` is not current.
 */
export function readStoredDatasetPayload(
	root: string,
	output: string,
	sha256: string,
): StoredDatasetPayload | undefined {
	const database = openReadOnlyDatabase(
		join(root, "data/build/atlas.sqlite"),
	);
	try {
		const row = database
			.prepare("SELECT sha256, payloadId FROM datasets WHERE output = ?")
			.get(output);
		if (!row || typeof row.payloadId === "string") return undefined;
		const cached = readCached(root, output, String(row.sha256));
		return cached?.sha256 === sha256 ? cached : undefined;
	} finally {
		database.release();
	}
}

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
	const result = readDatasetPayloadWithHash(root, output);
	return result && (sha256 === undefined || sha256 === result.sha256)
		? result.payload
		: undefined;
}

export function readDatasetPayloadWithHash(
	root: string,
	output: string,
): { payload: string; sha256: string } | undefined {
	const path = join(root, "data/build/atlas.sqlite");
	const database = openReadOnlyDatabase(path);
	try {
		const row = database
			.prepare(
				"SELECT type, sha256, payloadId FROM datasets WHERE output = ?",
			)
			.get(output);
		if (!row) return undefined;
		if (typeof row.payloadId === "string") {
			const stored = database
				.prepare("SELECT payload FROM payloads WHERE id = ?")
				.get(row.payloadId)?.payload;
			if (typeof stored !== "string")
				throw new Error(`Missing payload ${row.payloadId} at ${path}`);
			return { payload: stored, sha256: String(row.sha256) };
		}
		const current = String(row.sha256);
		const cached = readCached(root, output, current);
		if (cached !== undefined)
			return {
				payload: gunzipSync(cached.gzip).toString("utf8"),
				sha256: cached.sha256,
			};
		const rebuilt = rebuildDatasetPayload(
			database,
			String(row.type),
			output,
		);
		return { payload: rebuilt, sha256: digest(rebuilt) };
	} finally {
		database.release();
	}
}
