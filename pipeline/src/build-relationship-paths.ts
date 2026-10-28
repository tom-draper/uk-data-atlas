import { mkdirSync } from "node:fs";
import { buildArtifactPath } from "@uk-data-atlas/atlas-runtime/areas";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CrosswalkInventory } from "@uk-data-atlas/atlas-runtime/relationships";
import { compileRelationshipPaths, crosswalkShape } from "./relationshipPaths";
import { readApprovedRelationshipPaths } from "./relationshipPathAdapters";
import { readStoredText } from "@uk-data-atlas/artifacts";
import {
	artifactDirectory,
	configDirectory,
} from "@uk-data-atlas/atlas-runtime/storage";

// Long enough to rebase a local authority across a decade of releases, which
// takes one identity step per release in between.
export const MAXIMUM_DISCOVERED_STEPS = Number(
	process.env.MAXIMUM_DISCOVERED_STEPS ?? 24,
);

export const buildRelationshipPaths = (repositoryRoot: string) => {
	const directory = artifactDirectory(repositoryRoot);
	const crosswalks = JSON.parse(
		readFileSync(join(directory, "crosswalk-inventory.json"), "utf8"),
	) as CrosswalkInventory;
	const shapes = new Map(
		crosswalks.crosswalks.map((summary) => [
			summary.id,
			crosswalkShape(
				JSON.parse(readStoredText(join(directory, summary.artifact))),
			),
		]),
	);
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

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildRelationshipPaths(
		resolve(dirname(scriptPath), "../.."),
	);
	console.log(
		`Wrote ${result.count} relationship paths to ${result.outputPath}`,
	);
}
