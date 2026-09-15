import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AreaInventory, AreaReleaseArtifact } from "../src/areaInventory";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import {
	areaIdentityTable,
	compileLookupManifest,
	crosswalkTable,
	namedLocationMembersTable,
} from "../src/lookupExports";
import type { NamedLocationInventory } from "../src/namedLocations";

export const buildLookupManifest = (repositoryRoot: string) => {
	const publicDirectory = join(repositoryRoot, "api", "public");
	const read = <T>(path: string): T => {
		const fullPath = join(publicDirectory, path);
		if (!existsSync(fullPath)) {
			throw new Error(`Build ${path} before the lookup manifest.`);
		}
		return JSON.parse(readFileSync(fullPath, "utf8")) as T;
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
				read<CrosswalkArtifact>(crosswalk.artifact),
				crosswalk.artifact,
			),
		),
		namedLocationMembersTable(
			read<NamedLocationInventory>("named-locations.json"),
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
