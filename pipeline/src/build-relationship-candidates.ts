import { isMainModule } from "./lib/entrypoint.ts";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory, AreaReleaseArtifact } from "@uk-data-atlas/areas";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import { compileRelationshipCandidates } from "./relationships/relationshipCandidates.ts";
import {
	readCrosswalkAdapters,
	type PropertyCrosswalkAdapter,
} from "@uk-data-atlas/relationships";
import {
	artifactDirectory,
	configDirectory,
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-db";
import { readJsonSync } from "./lib/json.ts";

const readAreaArtifacts = (outputDirectory: string) => {
	const inventory = readJsonSync(
		join(outputDirectory, "area-inventory.json"),
	) as AreaInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error(
			"Invalid area inventory before compiling relationship candidates.",
		);
	}
	return inventory.releases.flatMap((release) => {
		if (release.status !== "available") return [];
		const path = join(outputDirectory, release.artifact);
		const artifact = readJsonSync(path) as AreaReleaseArtifact;
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
	const outputDirectory = artifactDirectory(repositoryRoot);
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const crosswalks = readJsonSync(
		join(outputDirectory, "crosswalk-inventory.json"),
	) as CrosswalkInventory;
	const inventory = compileRelationshipCandidates(
		repositoryRoot,
		readAreaArtifacts(outputDirectory),
		crosswalks.crosswalks,
		readCrosswalkAdapters(
			join(configDirectory(repositoryRoot), "crosswalk-adapters.json"),
		).filter(
			(adapter): adapter is PropertyCrosswalkAdapter =>
				adapter.method === "official-lookup" ||
				adapter.method === "clean-containment",
		),
	);
	const inventoryPath = join(outputDirectory, "relationship-candidates.json");
	writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { inventoryPath, candidateCount: inventory.candidates.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildRelationshipCandidates(repositoryRoot);
	buildLog.info(
		`Wrote ${formatCount(result.candidateCount)} relationship candidates to ${repoPath(result.inventoryPath)}`,
	);
}
