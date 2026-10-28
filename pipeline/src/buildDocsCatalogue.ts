import { buildArtifactPath } from "@uk-data-atlas/atlas-runtime/areas";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");

type ApiArtifact<T> = { path: string; sha256: string; data: T };

const sha256 = (contents: string) =>
	`sha256:${createHash("sha256").update(contents).digest("hex")}`;

function readArtifact<T>(path: string): ApiArtifact<T> {
	const contents = readFileSync(
		buildArtifactPath(repositoryRoot, path),
		"utf8",
	);
	return { path, sha256: sha256(contents), data: JSON.parse(contents) as T };
}

/**
 * API catalogue data used by website docs. The
 * source artifact hashes preserve the exact API build it describes.
 */
export function buildDocsCatalogue() {
	const catalog = readArtifact<{ datasets: unknown[]; measures: unknown[] }>(
		"data-catalog.json",
	);
	const exportsManifest = readArtifact<{ exports: unknown[] }>(
		"export-manifest.json",
	);
	const boundaryRegistry = readArtifact<{ releases: unknown[] }>(
		"boundary-releases.json",
	);
	const geographyInventory = readArtifact<{
		releases: Array<{
			id: string;
			geography: string;
			areaIdentities?: { status: string; recordCount?: number };
		}>;
	}>("geography-inventory.json");
	const mapResources = readArtifact<{ resources: Array<{ id: string }> }>(
		"map-resources.json",
	);
	const areaInventory = readArtifact<{
		releases: Array<{
			id: string;
			geography: string;
			status: "available" | "not-compiled";
		}>;
	}>("area-inventory.json");

	const snapshot = {
		schemaVersion: 1,
		sourceArtifacts: [
			catalog,
			exportsManifest,
			boundaryRegistry,
			geographyInventory,
			mapResources,
			areaInventory,
		].map(({ path, sha256: hash }) => ({ path, sha256: hash })),
		datasets: catalog.data.datasets,
		measures: catalog.data.measures,
		exports: exportsManifest.data.exports,
		releases: boundaryRegistry.data.releases,
		areaCounts: Object.fromEntries(
			geographyInventory.data.releases
				.filter(
					(release) =>
						release.areaIdentities?.recordCount !== undefined,
				)
				.map(
					(release) =>
						[
							`${release.geography}/${release.id}`,
							release.areaIdentities?.recordCount,
						] as const,
				)
				.sort(([left], [right]) => left.localeCompare(right)),
		),
		mapResourceIds: mapResources.data.resources
			.map((resource) => resource.id)
			.sort(),
		areaAvailability: areaInventory.data.releases
			.map(({ geography, id, status }) => ({ geography, id, status }))
			.sort(
				(left, right) =>
					left.geography.localeCompare(right.geography) ||
					left.id.localeCompare(right.id),
			),
	};

	const contents = `${JSON.stringify(snapshot)}\n`;
	return contents;
}
