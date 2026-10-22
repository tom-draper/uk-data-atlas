import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOGUE_DATASET_DEFINITIONS } from "@uk-data-atlas/datasets";
import { loadGazetteerCore } from "@uk-data-atlas/datasets/data/gazetteer/loader";
import { compileBoundaryAssets } from "./compile-boundaries.mts";

/**
 * Build the API's dataset folder: the catalogue datasets copied from
 * compiled/datasets, plus the boundary assets and gazetteer core it compiles
 * itself.
 */
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
	const compiledDirectory = join(repositoryRoot, "compiled", "datasets");
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
	const copy = (file: string) =>
		copyFile(
			join(compiledDirectory, file),
			join(directory, file),
			constants.COPYFILE_FICLONE,
		);
	const manifest = JSON.parse(
		await readFile(
			join(compiledDirectory, "dataset-manifest.json"),
			"utf8",
		).catch(() => {
			throw new Error(
				`No compiled datasets in ${compiledDirectory}. Run pnpm datasets:compile first.`,
			);
		}),
	) as { datasets: { type: string; output: string }[] };
	const compiled = new Map(
		manifest.datasets.map((entry) => [entry.type, entry.output]),
	);
	const missing = CATALOGUE_DATASET_DEFINITIONS.filter(
		(definition) =>
			compiled.get(definition.type) !== definition.precompiledFile,
	);
	if (missing.length > 0)
		throw new Error(
			`compiled/datasets has no ${missing.map(({ type }) => type).join(", ")}. Run pnpm datasets:compile first.`,
		);
	await Promise.all(
		manifest.datasets.map(({ output }) => copy(`${output}.json`)),
	);
	await copy("dataset-manifest.json");
	const datasets = manifest.datasets;
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
	return { directory, datasetCount: datasets.length };
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const result = await buildDatasets(resolve(import.meta.dirname, ".."));
	console.log(`Wrote ${result.datasetCount} datasets to ${result.directory}`);
}
