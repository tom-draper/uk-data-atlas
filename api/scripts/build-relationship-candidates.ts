import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory, AreaReleaseArtifact } from "../src/areaInventory";
import type { CrosswalkInventory } from "../src/crosswalkInventory";
import { compileRelationshipCandidates } from "../src/relationshipCandidates";

const readAreaArtifacts = (outputDirectory: string) => {
	const inventory = JSON.parse(
		readFileSync(join(outputDirectory, "area-inventory.json"), "utf8"),
	) as AreaInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error(
			"Invalid area inventory before compiling relationship candidates.",
		);
	}
	return inventory.releases.flatMap((release) => {
		if (release.status !== "available") return [];
		const path = join(outputDirectory, release.artifact);
		const artifact = JSON.parse(
			readFileSync(path, "utf8"),
		) as AreaReleaseArtifact;
		if (
			artifact.schemaVersion !== 1 ||
			artifact.contentHash !== release.contentHash
		) {
			throw new Error(`Invalid area release artifact at ${path}`);
		}
		return [artifact];
	});
};

export const buildRelationshipCandidates = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "api", "public");
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const crosswalks = JSON.parse(
		readFileSync(join(outputDirectory, "crosswalk-inventory.json"), "utf8"),
	) as CrosswalkInventory;
	const inventory = compileRelationshipCandidates(
		repositoryRoot,
		readAreaArtifacts(outputDirectory),
		crosswalks.crosswalks,
	);
	const inventoryPath = join(outputDirectory, "relationship-candidates.json");
	writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { inventoryPath, candidateCount: inventory.candidates.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildRelationshipCandidates(repositoryRoot);
	console.log(
		`Wrote ${result.candidateCount} relationship candidates to ${result.inventoryPath}`,
	);
}
