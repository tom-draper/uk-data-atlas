import { buildLog, repoPath } from "@uk-data-atlas/atlas-db";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildArtifactPath,
	geographyCatalogues,
} from "@uk-data-atlas/atlas-runtime/areas";

/** Finalise catalogue payloads after analysis has read the base database. */
export const buildGeographyCatalogues = (repositoryRoot: string) => {
	const payloads = geographyCatalogues.map((id) => ({
		id,
		payload: readFileSync(
			buildArtifactPath(repositoryRoot, `${id}.json`),
			"utf8",
		),
	}));
	const path = join(repositoryRoot, "data/build/geography-payloads.json");
	const temporary = `${path}.geography.tmp`;
	try {
		writeFileSync(temporary, JSON.stringify(payloads));
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	return path;
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath)
	buildLog.info(
		`Stored geography catalogues in ${repoPath(buildGeographyCatalogues(resolve(dirname(scriptPath), "../..")))}`,
	);
