import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { archiveCurrentAtlasRelease } from "../src/atlasReleaseHistory";

export const archiveAtlasRelease = (repositoryRoot: string) =>
	archiveCurrentAtlasRelease(resolve(repositoryRoot, "api", "public"));

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const archived = archiveAtlasRelease(resolve(dirname(scriptPath), "../.."));
	if (archived) console.log(`Archived atlas release ${archived.releaseId}`);
}
