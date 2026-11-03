import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { atlasCachePath } from "../storage/atlasCache";
import { rebuildFromLayout } from "./datasetLayout";
import { rebuildFromDeclaration } from "./declaredPayload";
import type { Json } from "./declaredStatistics";
import { rebuildFuelPoverty } from "./fuelPovertyStatistics";
import { rebuildAirQuality } from "./airQualityPayload";
import { STATISTICS_DATASETS } from "./statisticsDatasets";

const declared = new Map(
	STATISTICS_DATASETS.map((config) => [config.type, config]),
);

/** Whether a manifest type's JSON is rebuilt from rows instead of stored. */
export const servedFromRows = (type: string) =>
	type === "fuelPoverty" || declared.get(type)?.rebuild !== undefined;

/** Datasets that derived rules have read, once per database. */
const others = new WeakMap<
	DatabaseSync,
	Map<string, { readonly [key: string]: Json }>
>();

/** Whether a dataset's JSON is generated from rows, with no layout tables. */
export const generatedFromRows = (type: string, output: string) =>
	(type === "airQuality" && output === "air-quality") ||
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
	database: DatabaseSync,
	type: string,
	output: string,
): string {
	if (type === "fuelPoverty") return rebuildFuelPoverty(database);
	if (type === "airQuality" && output === "air-quality")
		return rebuildAirQuality(database);
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
	const rebuild = config?.rebuild;
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
				"SELECT sha256, payload FROM dataset_payloads WHERE output = ? AND source_sha256 = ?",
			)
			.get(output, sha256);
		return typeof row?.payload === "string" &&
			typeof row.sha256 === "string"
			? { payload: row.payload, sha256: row.sha256 }
			: undefined;
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
	const database = new DatabaseSync(path, { readOnly: true });
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
		if (cached !== undefined) return cached;
		const rebuilt = rebuildDatasetPayload(
			database,
			String(row.type),
			output,
		);
		return { payload: rebuilt, sha256: digest(rebuilt) };
	} finally {
		database.close();
	}
}
