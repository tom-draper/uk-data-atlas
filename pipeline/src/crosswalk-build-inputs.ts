import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	AreaInventory,
	AreaReleaseArtifact,
} from "../../shared/areaInventory";
import { createAreaLookup } from "../../shared/createAreaLookup";

export const readCompiledAreaLookup = (outputDirectory: string) => {
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
	return {
		areaLookup: createAreaLookup(artifacts),
		areaInventoryHash: inventory.contentHash,
	};
};
