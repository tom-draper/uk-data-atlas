import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AreaInventory, AreaReleaseArtifact } from "./areaInventory";
import { createAreaLookup } from "./createAreaLookup";
import type { CrosswalkArtifact } from "./crosswalkTypes";
import type { CrosswalkInventory } from "./crosswalkInventory";
import { compileLocationProjections } from "./locationProjections";
import type { NamedLocationInventory } from "./namedLocationTypes";
import {
	readStoredText,
	storedTextExists,
	writeStoredText,
} from "./storedText";

const read = <T>(directory: string, path: string): T => {
	const fullPath = join(directory, path);
	if (!storedTextExists(fullPath)) {
		throw new Error(`Build ${path} before location projections.`);
	}
	return JSON.parse(readStoredText(fullPath)) as T;
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
	const publicDirectory = join(repositoryRoot, "services/api/public");
	const outputDirectory = join(
		repositoryRoot,
		"data/build/location-projections",
	);
	mkdirSync(outputDirectory, { recursive: true });
	const namedLocations = read<NamedLocationInventory>(
		publicDirectory,
		"named-locations.json",
	);
	const crosswalkInventory = read<CrosswalkInventory>(
		publicDirectory,
		"crosswalk-inventory.json",
	);
	const projections = compileLocationProjections(
		namedLocations,
		crosswalkInventory,
		crosswalkInventory.crosswalks.map((crosswalk) =>
			read<CrosswalkArtifact>(publicDirectory, crosswalk.artifact),
		),
		readAreaLookup(publicDirectory),
	);
	for (const artifact of projections.parentArtifacts) {
		const outputPath = join(
			outputDirectory,
			"location-parent-projections",
			`${artifact.crosswalkId}.json`,
		);
		mkdirSync(dirname(outputPath), { recursive: true });
		writeStoredText(
			outputPath,
			`${JSON.stringify(artifact, null, "\t")}\n`,
		);
	}
	for (const artifact of projections.artifacts) {
		const outputPath = join(
			outputDirectory,
			"location-projections",
			`${artifact.crosswalkId}.json`,
		);
		mkdirSync(dirname(outputPath), { recursive: true });
		writeStoredText(
			outputPath,
			`${JSON.stringify(artifact, null, "\t")}\n`,
		);
	}
	const inventoryPath = join(
		outputDirectory,
		"location-projection-inventory.json",
	);
	writeFileSync(
		inventoryPath,
		`${JSON.stringify(projections.inventory, null, "\t")}\n`,
	);
	for (const name of [
		"location-projection-inventory.json",
		"location-projections",
		"location-parent-projections",
	])
		rmSync(join(publicDirectory, name), { recursive: true, force: true });

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
