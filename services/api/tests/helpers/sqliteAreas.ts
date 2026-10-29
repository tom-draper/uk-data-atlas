import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CrosswalkInventory } from "@uk-data-atlas/atlas-runtime/relationships";

export const emptyCrosswalkAreas = (
	directory: string,
	inventory: CrosswalkInventory,
) => {
	const releases = new Map(
		inventory.crosswalks
			.flatMap((entry) => [entry.from, entry.to])
			.map((endpoint) => [
				`${endpoint.geography}/${endpoint.boundaryRelease}`,
				{
					geography: endpoint.geography,
					id: endpoint.boundaryRelease,
					status: "not-compiled",
					reason: "fixture",
				},
			]),
	);
	writeFileSync(
		join(directory, "area-inventory.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "areas",
			boundaryRegistryHash: "registry",
			releases: [...releases.values()],
		}),
	);
};
