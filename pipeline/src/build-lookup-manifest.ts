import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	AreaInventory,
	AreaReleaseArtifact,
} from "@uk-data-atlas/atlas-runtime/areas";
import type { CrosswalkInventory } from "@uk-data-atlas/atlas-runtime/relationships";
import {
	areaIdentityTable,
	compileLookupManifest,
	crosswalkTable,
	namedLocationMembersTable,
} from "@uk-data-atlas/atlas-runtime/areas";
import type {
	LookupCrosswalk,
	LookupNamedLocations,
} from "@uk-data-atlas/atlas-runtime/areas";
import { readStoredText, storedTextExists } from "@uk-data-atlas/artifacts";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";

export const buildLookupManifest = (repositoryRoot: string) => {
	const publicDirectory = artifactDirectory(repositoryRoot);
	const read = <T>(path: string): T => {
		const fullPath = join(publicDirectory, path);
		if (!storedTextExists(fullPath)) {
			throw new Error(`Build ${path} before the lookup manifest.`);
		}
		return JSON.parse(readStoredText(fullPath)) as T;
	};
	const areaInventory = read<AreaInventory>("area-inventory.json");
	const crosswalkInventory = read<CrosswalkInventory>(
		"crosswalk-inventory.json",
	);
	const manifest = compileLookupManifest([
		...areaInventory.releases.flatMap((release) => {
			if (release.status !== "available") return [];
			const artifact = read<AreaReleaseArtifact>(release.artifact);
			return [
				areaIdentityTable({
					geography: artifact.geography,
					boundaryRelease: artifact.boundaryRelease,
					artifact: release.artifact,
					contentHash: artifact.contentHash,
					areas: artifact.areas,
				}),
			];
		}),
		...crosswalkInventory.crosswalks.map((crosswalk) =>
			crosswalkTable(
				read<LookupCrosswalk>(crosswalk.artifact),
				crosswalk.artifact,
			),
		),
		namedLocationMembersTable(
			read<LookupNamedLocations>("named-locations.json"),
			"named-locations.json",
		),
	]);
	const outputPath = join(publicDirectory, "lookup-manifest.json");
	writeFileSync(outputPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	return { outputPath, lookupCount: manifest.lookups.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildLookupManifest(resolve(dirname(scriptPath), "../.."));
	console.log(
		`Wrote ${result.lookupCount} bulk lookups to ${result.outputPath}`,
	);
}
