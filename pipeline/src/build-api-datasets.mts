import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadGazetteerCore } from "@uk-data-atlas/datasets/data/gazetteer/loader";
import { compileBoundaryAssets } from "./compile-boundaries.mts";

/** Build boundary assets and gazetteer core from raw data. */
export async function buildDatasets(repositoryRoot: string) {
	const directory = join(
		repositoryRoot,
		"services",
		"api",
		"public",
		"source-data",
	);
	await mkdir(directory, { recursive: true });
	await compileBoundaryAssets(directory);
	const core = await loadGazetteerCore((path) =>
		readFile(
			join(
				path.startsWith("boundaries/")
					? directory
					: join(repositoryRoot, "data/source"),
				path,
			),
			"utf8",
		),
	);
	const path = join(directory, "gazetteer.core.json");
	await writeFile(`${path}.tmp`, JSON.stringify(core));
	await rename(`${path}.tmp`, path);
	return { directory };
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const result = await buildDatasets(resolve(import.meta.dirname, "../.."));
	console.log(
		`Wrote boundary assets and gazetteer core to ${result.directory}`,
	);
}
