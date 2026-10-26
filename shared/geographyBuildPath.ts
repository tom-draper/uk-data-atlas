import { join } from "node:path";

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
		: join(repositoryRoot, "services/api/public", filename);
