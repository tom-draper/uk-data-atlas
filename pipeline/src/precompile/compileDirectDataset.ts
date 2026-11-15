import { rm } from "fs/promises";
import { join } from "path";
import { buildLog, msSince } from "@uk-data-atlas/atlas-db";
import { validatePrecompiledDataset } from "@uk-data-atlas/datasets";
import { directDigest } from "../statistics/directDigest.ts";
import { COMPILED_DATASETS } from "./paths.ts";
import { createTrackedReader } from "./trackedReader.ts";
import type { CatalogueDefinition, ExistingManifestDataset } from "./types.ts";

/**
 * The manifest entry of a dataset with no compiler (`direct.only`): its
 * sources are read once here for the inputs, the summary and a hash of the
 * parts, and no JSON is written. The `atlas-sqlite` stage reads them again for
 * the rows, and refuses to run if they no longer hash to this entry.
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
	// The same checks and summary a compiled dataset gets, run over the shape
	// its payload would have: one entry per part, one record per area.
	const summary = validatePrecompiledDataset(
		definition,
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
							records.map(({ code }) => [code, {}]),
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
	const compiled = directDigest(parts);
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
