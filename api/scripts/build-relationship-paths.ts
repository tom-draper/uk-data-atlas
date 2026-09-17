import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CrosswalkInventory } from "../src/crosswalkInventory";
import { compileRelationshipPaths } from "../src/relationshipPaths";
import { readApprovedRelationshipPaths } from "../src/relationshipPathAdapters";

export const buildRelationshipPaths = (repositoryRoot: string) => {
	const directory = join(repositoryRoot, "api", "public");
	const crosswalks = JSON.parse(
		readFileSync(join(directory, "crosswalk-inventory.json"), "utf8"),
	) as CrosswalkInventory;
	const paths = compileRelationshipPaths(
		crosswalks,
		readApprovedRelationshipPaths(
			join(repositoryRoot, "api", "config", "relationship-paths.json"),
		),
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
