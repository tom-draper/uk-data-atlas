import { mkdirSync } from "node:fs";
import { buildArtifactPath } from "@uk-data-atlas/areas";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import { compileRelationshipPaths } from "./relationshipPaths.ts";
import { readCrosswalkShapes } from "../storage/buildIntermediates.ts";
import { readApprovedRelationshipPaths } from "./relationshipPathAdapters.ts";
import { artifactDirectory, configDirectory } from "@uk-data-atlas/atlas-db";
import { readJsonSync } from "../lib/json.ts";

// Long enough to rebase a local authority across a decade of releases, which
// takes one identity step per release in between.
export const MAXIMUM_DISCOVERED_STEPS = Number(
	process.env.MAXIMUM_DISCOVERED_STEPS ?? 24,
);

export const buildRelationshipPaths = (repositoryRoot: string) => {
	const directory = artifactDirectory(repositoryRoot);
	const crosswalks = readJsonSync(
		join(directory, "crosswalk-inventory.json"),
	) as CrosswalkInventory;
	// Path discovery needs only whether each crosswalk is one to one in each
	// direction, which the edges in atlas-base.sqlite answer without records.
	const shapes = readCrosswalkShapes(repositoryRoot);
	const paths = compileRelationshipPaths(
		crosswalks,
		readApprovedRelationshipPaths(
			join(configDirectory(repositoryRoot), "relationship-paths.json"),
		),
		{ shapes, maximumSteps: MAXIMUM_DISCOVERED_STEPS },
	);
	const outputPath = buildArtifactPath(
		repositoryRoot,
		"relationship-paths.json",
	);
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(paths, null, "\t")}\n`);
	return { outputPath, count: paths.paths.length };
};
