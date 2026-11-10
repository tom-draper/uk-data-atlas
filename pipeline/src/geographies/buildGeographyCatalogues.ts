import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildArtifactPath, geographyCatalogues } from "@uk-data-atlas/areas";

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
