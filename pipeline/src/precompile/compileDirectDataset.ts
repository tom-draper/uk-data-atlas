import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { buildLog, msSince } from "@uk-data-atlas/atlas-db";
import { validatePrecompiledDataset } from "@uk-data-atlas/datasets";
import { out } from "./output.ts";
import { COMPILED_DATASETS, directPartsDirectory } from "./paths.ts";
import { createTrackedReader } from "./trackedReader.ts";
import type { CatalogueDefinition, ExistingManifestDataset } from "./types.ts";

/**
 * Normalize a direct-only dataset once. The private parts file supplies
 * rows to atlas-sqlite and its digest goes in the manifest.
 */
export async function compileDirectDataset(
	definition: CatalogueDefinition,
	fingerprint: string | undefined,
): Promise<ExistingManifestDataset> {
	const startedAt = performance.now();
	const direct = definition.directOnly;
	if (!direct)
		throw new Error(`${definition.type} is not a direct-only dataset`);
	const { reader, artifacts } = createTrackedReader();
	const parts = await direct.read(reader);
	// JSON would turn non-finite observations and bounds into nulls.
	for (const part of parts)
		for (const records of [
			part.records,
			...Object.values(part.recordSets ?? {}),
		])
			for (const { code, values } of records)
				for (const { value, lower, upper } of values)
					if (
						(value !== null && !Number.isFinite(value)) ||
						(lower !== undefined && !Number.isFinite(lower)) ||
						(upper !== undefined && !Number.isFinite(upper))
					)
						throw new Error(
							`${definition.type}: non-finite observation or bound for ${code}`,
						);
	// The same checks and summary a compiled dataset gets, run over the shape
	// its payload would have: one entry per part, one record per area.
	// The stub records below hold no fields, so `requiredDataFields` cannot be
	// checked here; every other part of the contract still is.
	const summary = validatePrecompiledDataset(
		{
			...definition,
			ingestion: definition.ingestion && {
				...definition.ingestion,
				requiredDataFields: undefined,
			},
		},
		Object.fromEntries(
			parts.map(({ key, records }) => {
				const header = direct.header(key);
				if (!header)
					throw new Error(
						`${definition.type}: the payload has no part ${key}`,
					);
				return [
					key,
					{
						...header,
						type: header.type as string,
						data: Object.fromEntries(
							records
								.filter(
									({ code }) =>
										!direct.exclude?.some((codes) =>
											codes.test(code),
										),
								)
								.map(({ code }) => [code, {}]),
						),
					},
				];
			}),
		),
	);
	// A file an earlier run compiled must not outlive the compiler.
	await rm(join(COMPILED_DATASETS, `${definition.precompiledFile}.json`), {
		force: true,
	});
	const directory = directPartsDirectory(COMPILED_DATASETS);
	await mkdir(directory, { recursive: true });
	const { bytes, sha256 } = await out(
		definition.precompiledFile,
		parts,
		directory,
	);
	const compiled = { bytes, sha256 };
	buildLog.artifact("dataset", `${definition.precompiledFile} (rows)`, {
		status: "read from source",
		bytes: compiled.bytes,
		ms: msSince(startedAt),
	});
	return {
		inputTrackingVersion: 1,
		type: definition.type,
		output: definition.precompiledFile,
		source: definition.source,
		inputs: [...artifacts.values()].sort((left, right) =>
			left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
		),
		summary,
		compiled,
		fingerprint,
		direct: true,
	};
}
