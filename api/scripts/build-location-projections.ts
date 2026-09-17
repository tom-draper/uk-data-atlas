import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	createAreaLookup,
	type AreaInventory,
	type AreaReleaseArtifact,
} from "../src/areaInventory";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import { compileLocationProjections } from "../src/locationProjections";
import type { NamedLocationInventory } from "../src/namedLocations";

const read = <T>(directory: string, path: string): T => {
	const fullPath = join(directory, path);
	if (!existsSync(fullPath)) {
		throw new Error(`Build ${path} before location projections.`);
	}
	return JSON.parse(readFileSync(fullPath, "utf8")) as T;
};

const readAreaLookup = (directory: string) => {
	const inventory = read<AreaInventory>(directory, "area-inventory.json");
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error("Invalid area inventory before location projections.");
	}
	return createAreaLookup(
		inventory.releases.flatMap((release) =>
			release.status === "available"
				? [read<AreaReleaseArtifact>(directory, release.artifact)]
				: [],
		),
	);
};

export const buildLocationProjections = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "api", "public");
	const namedLocations = read<NamedLocationInventory>(
		outputDirectory,
		"named-locations.json",
	);
	const crosswalkInventory = read<CrosswalkInventory>(
		outputDirectory,
		"crosswalk-inventory.json",
	);
	const projections = compileLocationProjections(
		namedLocations,
		crosswalkInventory,
		crosswalkInventory.crosswalks.map((crosswalk) =>
			read<CrosswalkArtifact>(outputDirectory, crosswalk.artifact),
		),
		readAreaLookup(outputDirectory),
	);
	for (const artifact of projections.parentArtifacts) {
		const outputPath = join(
			outputDirectory,
			"location-parent-projections",
			`${artifact.crosswalkId}.json`,
		);
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, `${JSON.stringify(artifact, null, "\t")}\n`);
	}
	for (const artifact of projections.artifacts) {
		const outputPath = join(
			outputDirectory,
			"location-projections",
			`${artifact.crosswalkId}.json`,
		);
		mkdirSync(dirname(outputPath), { recursive: true });
		writeFileSync(outputPath, `${JSON.stringify(artifact, null, "\t")}\n`);
	}
	const inventoryPath = join(
		outputDirectory,
		"location-projection-inventory.json",
	);
	writeFileSync(
		inventoryPath,
		`${JSON.stringify(projections.inventory, null, "\t")}\n`,
	);
	return {
		inventoryPath,
		shardCount: projections.artifacts.length,
		parentShardCount: projections.parentArtifacts.length,
		count: projections.artifacts.reduce(
			(total, artifact) => total + artifact.projections.length,
			0,
		),
	};
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildLocationProjections(repositoryRoot);
	console.log(
		`Wrote ${result.count} location projections in ${result.shardCount} shards, and parents in ${result.parentShardCount} shards, to ${result.inventoryPath}`,
	);
}
