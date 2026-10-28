import { join } from "node:path";
import { artifactDirectory } from "../storage/dataLayout";

export const geographyCatalogues = [
	"boundary-releases",
	"geography-inventory",
	"relationship-paths",
	"analysis-geographies",
	"analysis-geography-validation",
];

/** Compiler inputs are kept outside the API's public directory. */
export const buildArtifactPath = (repositoryRoot: string, filename: string) =>
	geographyCatalogues.includes(filename.replace(/\.json$/, ""))
		? join(repositoryRoot, "data/build/geography", filename)
		: join(artifactDirectory(repositoryRoot), filename);
