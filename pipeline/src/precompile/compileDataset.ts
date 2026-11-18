import { buildLog, msSince } from "@uk-data-atlas/atlas-db";
import { canReuseDataset, NO_REUSE } from "./cache.ts";
import { compileDirectDataset } from "./compileDirectDataset.ts";
import type { CatalogueDefinition, ReuseContext } from "./types.ts";

/**
 * The manifest entry of a dataset an earlier run compiled, when none of its
 * inputs have changed since. Undefined when it has to be compiled.
 */
export async function reuseDataset(
	definition: CatalogueDefinition,
	{ datasetFingerprints, existingDatasets, sourceRelease }: ReuseContext,
) {
	const startedAt = performance.now();
	const existing = existingDatasets.get(definition.type);
	const cached = await canReuseDataset(
		existing,
		definition,
		sourceRelease,
		datasetFingerprints[definition.type],
	);
	if (!cached || !existing) return undefined;
	buildLog.artifact("dataset", `${definition.precompiledFile} (rows)`, {
		status: "cached",
		bytes: cached.bytes,
		ms: msSince(startedAt),
	});
	return { ...existing, compiled: cached };
}

/**
 * Reads one dataset's sources into its manifest entry, or reuses the entry an
 * earlier run left when none of its inputs have changed.
 */
export async function compileDataset(
	definition: CatalogueDefinition,
	reuse: ReuseContext = NO_REUSE,
) {
	return (
		(await reuseDataset(definition, reuse)) ??
		compileDirectDataset(
			definition,
			reuse.datasetFingerprints[definition.type],
		)
	);
}
