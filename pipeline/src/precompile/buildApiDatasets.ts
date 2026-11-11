import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadGazetteerCore } from "@uk-data-atlas/datasets";
import { compileBoundaryAssets } from "./compileBoundaries.ts";
import { artifactDirectory, buildLog } from "@uk-data-atlas/atlas-db";

/** Build boundary assets and gazetteer core from raw data. */
export async function buildDatasets(repositoryRoot: string) {
	const directory = join(artifactDirectory(repositoryRoot), "source-data");
	await mkdir(directory, { recursive: true });
	await compileBoundaryAssets(directory);
	const core = await loadGazetteerCore(
		(path) =>
			readFile(
				join(
					path.startsWith("boundaries/")
						? directory
						: join(repositoryRoot, "data/source"),
					path,
				),
				"utf8",
			),
		buildLog,
	);
	const path = join(directory, "gazetteer.core.json");
	await writeFile(`${path}.tmp`, JSON.stringify(core));
	await rename(`${path}.tmp`, path);
	return { directory };
}
