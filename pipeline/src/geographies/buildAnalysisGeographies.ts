import { buildArtifactPath } from "@uk-data-atlas/areas";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import {
	compileAnalysisGeographies,
	readAnalysisGeographySupport,
} from "./analysisGeographies.ts";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type { DataCatalog } from "@uk-data-atlas/measures";
import type { RelationshipPathInventory } from "@uk-data-atlas/relationships";
import { artifactDirectory, configDirectory } from "@uk-data-atlas/atlas-db";
import { readJsonSync } from "../lib/json.ts";

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
		? (readJsonSync(pathsPath) as RelationshipPathInventory)
		: undefined;
	const inventory = compileAnalysisGeographies(
		readAnalysisGeographySupport(
			join(configDirectory(repositoryRoot), "analysis-geographies.json"),
		),
		readJsonSync(catalogPath) as DataCatalog,
		readJsonSync(crosswalkPath) as CrosswalkInventory,
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
