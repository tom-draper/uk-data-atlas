import { isMainModule } from "../lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLog, repoPath } from "@uk-data-atlas/atlas-db";
import { buildAtlasRelease } from "../atlas/buildAtlasRelease.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../../..");
	const result = buildAtlasRelease(repositoryRoot);
	buildLog.info(
		`Wrote atlas release ${result.releaseId} to ${repoPath(result.releasePath)}`,
	);
}
