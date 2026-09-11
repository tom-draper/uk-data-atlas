import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCrosswalkAdapters } from "../src/crosswalkAdapters";
import { compileCrosswalks } from "../src/crosswalkInventory";
import { readGeometrySourceLookup } from "../src/geometrySources";
import {
	createAreaLookup,
	type AreaInventory,
	type AreaReleaseArtifact,
} from "../src/areaInventory";

const readCompiledAreaLookup = (outputDirectory: string) => {
	const inventory = JSON.parse(
		readFileSync(join(outputDirectory, "area-inventory.json"), "utf8"),
	) as AreaInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error("Invalid area inventory before compiling crosswalks.");
	}
	const artifacts = inventory.releases.flatMap((release) => {
		if (release.status !== "available") return [];
		const path = join(outputDirectory, release.artifact);
		const artifact = JSON.parse(
			readFileSync(path, "utf8"),
		) as AreaReleaseArtifact;
		if (
			artifact.schemaVersion !== 1 ||
			artifact.contentHash !== release.contentHash ||
			!Array.isArray(artifact.areas)
		) {
			throw new Error(`Invalid area release artifact at ${path}`);
		}
		return [artifact];
	});
	return createAreaLookup(artifacts);
};

export const buildCrosswalkInventory = (repositoryRoot: string) => {
	const outputDirectory = join(repositoryRoot, "api", "public");
	if (!existsSync(outputDirectory)) {
		throw new Error(
			`Create the API public directory before building: ${outputDirectory}`,
		);
	}
	const { inventory, artifacts } = compileCrosswalks(
		repositoryRoot,
		readCrosswalkAdapters(
			join(repositoryRoot, "api", "config", "crosswalk-adapters.json"),
		),
		readCompiledAreaLookup(outputDirectory),
		readGeometrySourceLookup(join(repositoryRoot, "api")),
	);
	for (const artifact of artifacts) {
		const path = join(outputDirectory, "crosswalks", `${artifact.id}.json`);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `${JSON.stringify(artifact, null, "\t")}\n`);
	}
	const inventoryPath = join(outputDirectory, "crosswalk-inventory.json");
	writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, "\t")}\n`);
	return { inventoryPath, crosswalkCount: artifacts.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const repositoryRoot = resolve(dirname(scriptPath), "../..");
	const result = buildCrosswalkInventory(repositoryRoot);
	console.log(
		`Wrote ${result.crosswalkCount} crosswalk to ${result.inventoryPath}`,
	);
}
