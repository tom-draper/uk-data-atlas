import { join } from "node:path";
import type { AreaInventory, AreaReleaseArtifact } from "@uk-data-atlas/areas";
import { createAreaLookup } from "@uk-data-atlas/areas";
import { readJsonSync } from "../lib/json.ts";

export const readCompiledAreaLookup = (outputDirectory: string) => {
	const inventory = readJsonSync(
		join(outputDirectory, "area-inventory.json"),
	) as AreaInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.releases)) {
		throw new Error("Invalid area inventory before compiling crosswalks.");
	}
	const artifacts = inventory.releases.flatMap((release) => {
		if (release.status !== "available") return [];
		const path = join(outputDirectory, release.artifact);
		const artifact = readJsonSync(path) as AreaReleaseArtifact;
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
