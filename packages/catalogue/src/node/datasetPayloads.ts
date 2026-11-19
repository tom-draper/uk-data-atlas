import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { atlasCacheFile } from "@uk-data-atlas/atlas-db";
import { openBuildMetadata, readBuildPayload } from "@uk-data-atlas/atlas-db";
import { openReadOnlyDatabase, type SqlReader } from "@uk-data-atlas/atlas-db";
import { rebuildFromDeclaration } from "@uk-data-atlas/measures";
import type { Json } from "@uk-data-atlas/measures";
import { STATISTICS_DATASETS } from "@uk-data-atlas/measures";

const declared = new Map(
	STATISTICS_DATASETS.map((config) => [config.type, config]),
);

/**
 * Whether a manifest type's JSON is generated from statistics rows instead of
 * stored, so it carries no layout tables and compares by what rows can say.
 */
export const servedFromRows = (type: string) =>
	declared.get(type)?.payload !== undefined;

/** Datasets that derived rules have read, once per database. */
const others = new WeakMap<
	SqlReader,
	Map<string, { readonly [key: string]: Json }>
>();

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

/**
 * The compiled type of each dataset slug, from the build metadata that holds
 * it. Undefined for a dataset with no compiled output.
 */
export function compiledDatasetTypes(build: SqlReader) {
	const statement = build.prepare(
		"SELECT compiled_type AS type FROM dataset_build WHERE slug = ? AND compiled_type IS NOT NULL",
	);
	return (slug: string): string | undefined => {
		const type = statement.get(slug)?.type;
		return typeof type === "string" ? type : undefined;
	};
}

/** Without build metadata, a dataset's slug is its declared type. */
const declaredType = (slug: string) => (declared.has(slug) ? slug : undefined);

/**
 * A dataset's compiled JSON, rebuilt from the canonical rows. `typeOf` says
 * what compiled type another dataset has, for rules that read one.
 */
export function rebuildDatasetPayload(
	database: SqlReader,
	type: string,
	output: string,
	typeOf: (slug: string) => string | undefined = declaredType,
): string {
	const config = declared.get(type);
	if (config?.payload)
		return rebuildFromDeclaration(database, config, output, (other) => {
			let read = others.get(database);
			if (!read) others.set(database, (read = new Map()));
			let found = read.get(other);
			if (!found) {
				const type = typeOf(other);
				if (type === undefined)
					throw new Error(`Unknown dataset ${other}`);
				read.set(
					other,
					(found = JSON.parse(
						rebuildDatasetPayload(database, type, other, typeOf),
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
	const path = atlasCacheFile(root, "datasets");
	if (!existsSync(path)) return undefined;
	const cache = openReadOnlyDatabase(path);
	try {
		const row = cache
			.prepare(
				"SELECT sha256, bytes, gzip FROM dataset_payload WHERE output = ? AND source_sha256 = ?",
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
	const build = openBuildMetadata(join(root, "data/build/atlas.sqlite"));
	try {
		const row = build
			.prepare(
				"SELECT compiled_sha256 AS sha256, payload_id AS payloadId FROM dataset_build WHERE slug = ? AND compiled_type IS NOT NULL",
			)
			.get(output);
		if (!row || typeof row.payloadId === "string") return undefined;
		const cached = readCached(root, output, String(row.sha256));
		return cached?.sha256 === sha256 ? cached : undefined;
	} finally {
		build.release();
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
	const build = openBuildMetadata(path);
	try {
		const row = build
			.prepare(
				"SELECT compiled_type AS type, compiled_sha256 AS sha256, payload_id AS payloadId FROM dataset_build WHERE slug = ? AND compiled_type IS NOT NULL",
			)
			.get(output);
		if (!row) return undefined;
		if (typeof row.payloadId === "string") {
			const stored = readBuildPayload(path, String(row.payloadId));
			if (stored === undefined)
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
		const database = openReadOnlyDatabase(path);
		try {
			const rebuilt = rebuildDatasetPayload(
				database,
				String(row.type),
				output,
				compiledDatasetTypes(build),
			);
			return { payload: rebuilt, sha256: digest(rebuilt) };
		} finally {
			database.release();
		}
	} finally {
		build.release();
	}
}
