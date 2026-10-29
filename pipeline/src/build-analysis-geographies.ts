import { buildArtifactPath } from "@uk-data-atlas/atlas-runtime/areas";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
	compileAnalysisGeographies,
	readAnalysisGeographySupport,
} from "./analysisGeographies";
import type { CrosswalkInventory } from "@uk-data-atlas/atlas-runtime/relationships";
import type { DataCatalog } from "@uk-data-atlas/measures";
import type { RelationshipPathInventory } from "@uk-data-atlas/atlas-runtime/relationships";
import {
	artifactDirectory,
	configDirectory,
} from "@uk-data-atlas/atlas-runtime/storage";

export const buildAnalysisGeographies = (repositoryRoot: string) => {
	const directory = artifactDirectory(repositoryRoot);
	const catalogPath = join(directory, "data-catalog.json");
	const crosswalkPath = join(directory, "crosswalk-inventory.json");
	if (!existsSync(catalogPath) || !existsSync(crosswalkPath))
		throw new Error(
			"Build the data catalogue and crosswalk inventory before analysis geographies.",
		);
	// Read only if built: a path-backed support needs it, and compiling
	// refuses one without it.
	const pathsPath = buildArtifactPath(
		repositoryRoot,
		"relationship-paths.json",
	);
	const relationshipPaths = existsSync(pathsPath)
		? (JSON.parse(
				readFileSync(pathsPath, "utf8"),
			) as RelationshipPathInventory)
		: undefined;
	const inventory = compileAnalysisGeographies(
		readAnalysisGeographySupport(
			join(configDirectory(repositoryRoot), "analysis-geographies.json"),
		),
		JSON.parse(readFileSync(catalogPath, "utf8")) as DataCatalog,
		JSON.parse(readFileSync(crosswalkPath, "utf8")) as CrosswalkInventory,
		relationshipPaths,
	);
	const outputPath = buildArtifactPath(
		repositoryRoot,
		"analysis-geographies.json",
	);
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { outputPath, count: inventory.supports.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildAnalysisGeographies(
		resolve(dirname(scriptPath), "../.."),
	);
	console.log(
		`Wrote ${result.count} analysis geography support entries to ${result.outputPath}`,
	);
}
