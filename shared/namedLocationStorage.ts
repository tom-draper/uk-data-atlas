import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { NamedLocationInventory } from "./namedLocations";

export const packNamedLocations = (
	directory: string,
	inventory: NamedLocationInventory,
) => {
	mkdirSync(join(directory, "location-geometries"), { recursive: true });
	const locations = inventory.locations.map(({ geometry, ...metadata }) => {
		if (!geometry) return metadata;
		const content = JSON.stringify(geometry);
		const hash = createHash("sha256").update(content).digest("hex");
		const geometryArtifact = `location-geometries/${hash}.json`;
		writeFileSync(join(directory, geometryArtifact), content);
		return { ...metadata, geometryArtifact };
	});
	writeFileSync(
		join(directory, "named-locations-metadata.json"),
		JSON.stringify({ ...inventory, locations }),
	);
};
