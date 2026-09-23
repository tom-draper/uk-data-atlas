import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiPublic = join(root, "api", "public");
const output = join(root, "data", "precompiled", "docs-catalogue.json");

type ApiArtifact<T> = { path: string; sha256: string; data: T };

const sha256 = (contents: string) =>
	`sha256:${createHash("sha256").update(contents).digest("hex")}`;

function readArtifact<T>(path: string): ApiArtifact<T> {
	const contents = readFileSync(join(apiPublic, path), "utf8");
	return { path, sha256: sha256(contents), data: JSON.parse(contents) as T };
}

/**
 * Compact, committed API catalogue data used by static website docs. The
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
				.map((release) => [
					`${release.geography}/${release.id}`,
					release.areaIdentities?.recordCount,
				])
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
	mkdirSync(dirname(output), { recursive: true });
	const temporary = `${output}.${process.pid}.tmp`;
	writeFileSync(temporary, contents);
	renameSync(temporary, output);
	return { output, bytes: Buffer.byteLength(contents) };
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildDocsCatalogue();
	console.log(
		`Wrote docs catalogue (${result.bytes} bytes) to ${result.output}`,
	);
}
