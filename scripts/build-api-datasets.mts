import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	CATALOGUE_DATASET_DEFINITIONS,
	compileDatasetContents,
	validatePrecompiledDataset,
} from "@uk-data-atlas/datasets";
import { loadGazetteerCore } from "@uk-data-atlas/datasets/data/gazetteer/loader";
import { encodeCompactPayload } from "@uk-data-atlas/catalogue/compactPayload";
import { compileBoundaryAssets } from "./compile-boundaries.mts";
import { createTrackedReader } from "./precompile/trackedReader.mts";

/** Build API-owned inputs from raw data, one dataset at a time. */
export async function buildDatasets(repositoryRoot: string) {
	const directory = join(
		repositoryRoot,
		"services",
		"api",
		"public",
		"datasets",
	);
	const boundaryDirectory = join(
		repositoryRoot,
		"services",
		"api",
		"public",
		"source-data",
	);
	await mkdir(directory, { recursive: true });
	await compileBoundaryAssets(boundaryDirectory);
	const write = async (name: string, value: unknown) => {
		const content = JSON.stringify(value);
		const path = join(directory, `${name}.json`);
		await writeFile(`${path}.tmp`, content);
		await rename(`${path}.tmp`, path);
		return {
			bytes: Buffer.byteLength(content),
			sha256: createHash("sha256").update(content).digest("hex"),
		};
	};
	const datasets = [];
	for (const definition of CATALOGUE_DATASET_DEFINITIONS) {
		const { reader, artifacts } = createTrackedReader();
		const data = await compileDatasetContents(definition, reader);
		const summary = validatePrecompiledDataset(definition, data);
		const compiled = await write(
			definition.precompiledFile,
			encodeCompactPayload(data),
		);
		datasets.push({
			type: definition.type,
			output: definition.precompiledFile,
			source: definition.source,
			contract: definition.ingestion ?? {},
			inputs: [...artifacts.values()].sort((a, b) =>
				a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
			),
			summary,
			compiled,
		});
		console.log(
			`Compiled ${definition.precompiledFile}.json (${compiled.bytes} bytes)`,
		);
	}
	const core = await loadGazetteerCore((path) =>
		readFile(
			join(
				path.startsWith("boundaries/")
					? boundaryDirectory
					: join(repositoryRoot, "data"),
				path,
			),
			"utf8",
		),
	);
	await write("gazetteer.core", core);
	await write("dataset-manifest", { version: 1, datasets });
	return { directory, datasetCount: datasets.length };
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const result = await buildDatasets(resolve(import.meta.dirname, ".."));
	console.log(`Wrote ${result.datasetCount} datasets to ${result.directory}`);
}
