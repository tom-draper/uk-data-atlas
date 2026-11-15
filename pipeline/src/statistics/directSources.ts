import { STATISTICS_DATASETS } from "@uk-data-atlas/measures";
import type { DirectPart } from "@uk-data-atlas/datasets";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTrackedReader } from "../precompile/trackedReader.ts";

/** The parts of each dataset that reads its sources directly, by type. */
export type DirectParts = ReadonlyMap<string, readonly DirectPart[]>;

/** The types whose statistics rows are read from their sources, not compiled JSON. */
export const DIRECT_TYPES: readonly string[] = STATISTICS_DATASETS.filter(
	(config) => config.direct,
).map((config) => config.type);

/**
 * Reads every direct dataset's sources. The build is synchronous from here, so
 * this runs first. A direct reader must read only files the dataset's compiler
 * already reads: the `datasets` stage fingerprints those, so a changed source
 * reruns the statistics build, and the manifest's `inputs` name them.
 */
export async function readDirectParts(
	inputsOf: (type: string) => readonly { path: string }[],
	types: readonly string[] = DIRECT_TYPES,
): Promise<DirectParts> {
	const parts = new Map<string, readonly DirectPart[]>();
	for (const type of types) {
		const config = STATISTICS_DATASETS.find((entry) => entry.type === type);
		if (!config?.direct)
			throw new Error(`${type} does not read its sources directly`);
		const { reader, artifacts } = createTrackedReader();
		parts.set(type, await config.direct.read(reader));
		const compiled = new Set(inputsOf(type).map(({ path }) => path));
		for (const { path } of artifacts.values())
			if (!compiled.has(path))
				throw new Error(
					`${type}: its direct reader reads ${path}, which its compiler does not`,
				);
	}
	return parts;
}

/** `readDirectParts`, with the inputs the built manifest records for each compiler. */
export const readDirectPartsFor = (repositoryRoot: string) => {
	const manifest = JSON.parse(
		readFileSync(
			join(repositoryRoot, "data/build/datasets/dataset-manifest.json"),
			"utf8",
		),
	) as { datasets: { type: string; inputs: { path: string }[] }[] };
	return readDirectParts(
		(type) =>
			manifest.datasets.find((entry) => entry.type === type)?.inputs ??
			[],
	);
};
