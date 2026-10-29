import { buildArtifactPath } from "@uk-data-atlas/atlas-runtime/areas";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(apiRoot, "../..");
const inputs = {};
const read = (name, field) => {
	const artifact = JSON.parse(
		readFileSync(buildArtifactPath(repositoryRoot, name), "utf8"),
	);
	if (artifact.schemaVersion !== 1 || !Array.isArray(artifact[field]))
		throw new Error(
			`Rebuild ${name}: expected a version 1 ${field} array.`,
		);
	inputs[name] = artifact.contentHash;
	return artifact;
};

const registry = read("boundary-releases.json", "releases");
const maps = read("map-resources.json", "resources");
const inventory = read("geography-inventory.json", "releases");
const candidates = read("relationship-candidates.json", "candidates");
const sources = read("geometry-sources.json", "releases");
if (!Array.isArray(maps.unavailable))
	throw new Error("Rebuild map-resources.json: missing unavailable array.");
const key = (release) => `${release.geography}/${release.id}`;
const sourceById = new Map(
	sources.releases.map((source) => [source.id, source]),
);
const mapById = new Map(
	maps.resources.map((resource) => [resource.id, resource]),
);
const unavailableById = new Map(
	maps.unavailable.map((release) => [
		`${release.geography}/${release.boundaryRelease}`,
		release,
	]),
);

const deliveryGaps = registry.releases.flatMap((release) => {
	const id = key(release);
	if (mapById.has(id)) return [];
	const unavailable = unavailableById.get(id);
	const source = sourceById.get(id);
	const downloads = unavailable?.features ?? [];
	const gap = {
		id,
		status: downloads.length > 0 ? "downloads-only" : "no-map-artifacts",
		reason:
			unavailable?.reason ??
			"No map manifest entry exists for this release.",
		source: source ?? null,
	};
	// Inspect a missing release's declared source, without loading every large
	// boundary file merely to audit the manifest.
	if (downloads.length === 0 && source?.input?.endsWith(".geojson")) {
		const raw = JSON.parse(
			readFileSync(
				resolve(repositoryRoot, "data/source", source.input),
				"utf8",
			),
		);
		if (!Array.isArray(raw.features))
			throw new Error(`No features array in ${source.input}.`);
		gap.sourceFeatures = raw.features.length;
		gap.sourceFeaturesWithGeometry = raw.features.filter(
			(feature) => feature.geometry != null,
		).length;
	}
	return [gap];
});

console.log(
	JSON.stringify(
		{
			inputs,
			summary: {
				releases: registry.releases.length,
				tiledReleases: maps.resources.length,
				downloadableReleases:
					maps.resources.length +
					maps.unavailable.filter(
						(entry) => entry.features?.length > 0,
					).length,
			},
			deliveryGaps,
			relationshipGaps: inventory.releases
				.filter(
					(release) => release.relationships.status !== "available",
				)
				.map((release) => ({
					id: key(release),
					...release.relationships,
				})),
			unpublishedCandidates: candidates.candidates.filter(
				(candidate) => !candidate.publishedCrosswalkId,
			),
			archive: [
				...new Set(
					registry.releases.map((release) => release.geography),
				),
			]
				.sort()
				.map((geography) => ({
					geography,
					releases: registry.releases
						.filter((release) => release.geography === geography)
						.map((release) => release.id)
						.sort(),
				})),
		},
		null,
		2,
	),
);
