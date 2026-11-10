import { isMainModule } from "./lib/entrypoint.ts";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory, AreaReleaseArtifact } from "@uk-data-atlas/areas";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import {
	areaIdentityTable,
	compileLookupManifest,
	crosswalkTable,
	namedLocationMembersTable,
} from "@uk-data-atlas/areas";
import type {
	LookupCrosswalk,
	LookupNamedLocations,
} from "@uk-data-atlas/areas";
import { readStoredText, storedTextExists } from "@uk-data-atlas/artifacts";
import {
	artifactDirectory,
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-db";

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
	// Each table is built when the compiler asks for it and released after it
	// is rendered, so only one table's rows are in memory at a time.
	function* tables() {
		for (const release of areaInventory.releases) {
			if (release.status !== "available") continue;
			const artifact = read<AreaReleaseArtifact>(release.artifact);
			yield areaIdentityTable({
				geography: artifact.geography,
				boundaryRelease: artifact.boundaryRelease,
				artifact: release.artifact,
				contentHash: artifact.contentHash,
				areas: artifact.areas,
			});
		}
		for (const crosswalk of crosswalkInventory.crosswalks)
			yield crosswalkTable(
				read<LookupCrosswalk>(crosswalk.artifact),
				crosswalk.artifact,
			);
		yield namedLocationMembersTable(
			read<LookupNamedLocations>("named-locations.json"),
			"named-locations.json",
		);
	}
	const manifest = compileLookupManifest(tables());
	const outputPath = join(publicDirectory, "lookup-manifest.json");
	writeFileSync(outputPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	return { outputPath, lookupCount: manifest.lookups.length };
};

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const result = buildLookupManifest(resolve(dirname(scriptPath), "../.."));
	buildLog.info(
		`Wrote ${formatCount(result.lookupCount)} bulk lookups to ${repoPath(result.outputPath)}`,
	);
}
