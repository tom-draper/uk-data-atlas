import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import {
	compileRelationshipPaths,
	crosswalkShape,
} from "../src/relationshipPaths";
import { readApprovedRelationshipPaths } from "../src/relationshipPathAdapters";

// Long enough to rebase a local authority across a decade of releases, which
// takes one identity step per release in between.
export const MAXIMUM_DISCOVERED_STEPS = Number(
	process.env.MAXIMUM_DISCOVERED_STEPS ?? 24,
);

export const buildRelationshipPaths = (repositoryRoot: string) => {
	const directory = join(repositoryRoot, "api", "public");
	const crosswalks = JSON.parse(
		readFileSync(join(directory, "crosswalk-inventory.json"), "utf8"),
	) as CrosswalkInventory;
	const shapes = new Map(
		crosswalks.crosswalks.map((summary) => [
			summary.id,
			crosswalkShape(
				JSON.parse(
					readFileSync(join(directory, summary.artifact), "utf8"),
				) as CrosswalkArtifact,
			),
		]),
	);
	const paths = compileRelationshipPaths(
		crosswalks,
		readApprovedRelationshipPaths(
			join(repositoryRoot, "api", "config", "relationship-paths.json"),
		),
		{ shapes, maximumSteps: MAXIMUM_DISCOVERED_STEPS },
	);
	const outputPath = join(directory, "relationship-paths.json");
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
