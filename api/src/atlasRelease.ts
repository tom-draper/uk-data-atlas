import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	isLegacyPopulationSource,
	observationArtifactName,
	type DataCatalog,
} from "./dataCatalog";

export type AtlasReleaseArtifactRef = {
	id: string;
	path: string;
	contentHash: string;
};

export const RESOURCE_KINDS = [
	"datasets",
	"measures",
	"boundaryReleases",
	"areaIdentities",
	"geometrySources",
	"crosswalks",
	"validationExceptions",
	"namedLocations",
	"exports",
	"lookups",
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export type AtlasRelease = {
	schemaVersion: 1;
	releaseId: string;
	artifacts: AtlasReleaseArtifactRef[];
	/**
	 * A fingerprint for every resource inside the artifacts, keyed by kind and
	 * resource id, so a comparison can say which ones changed. Every value is
	 * computed from an artifact the release already hashes, so it does not
	 * enter the release id. Releases archived before fingerprints were
	 * recorded have none.
	 */
	resources?: Partial<Record<ResourceKind, Record<string, string>>>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const RELEASE_ARTIFACTS: Array<{ id: string; path: string }> = [
	{ id: "boundary-registry", path: "boundary-releases.json" },
	{ id: "derived-boundaries", path: "derived-boundaries.json" },
	{ id: "area-inventory", path: "area-inventory.json" },
	{ id: "named-locations", path: "named-locations.json" },
	{
		id: "location-projection-inventory",
		path: "location-projection-inventory.json",
	},
	{ id: "data-catalog", path: "data-catalog.json" },
	{ id: "measure-compatibility", path: "measure-compatibility.json" },
	{ id: "export-manifest", path: "export-manifest.json" },
	{ id: "lookup-manifest", path: "lookup-manifest.json" },
	// The descriptor holds the hash of every tile archive and GeoParquet file,
	// so pinning it pins them: a pinned map URL is served immutable.
	{ id: "map-resources", path: "map-resources.json" },
	{ id: "population-observations", path: "population-observations.json" },
	{
		id: "population-local-authority-observations",
		path: "population-local-authority-observations.json",
	},
	{ id: "geometry-sources", path: "geometry-sources.json" },
	{ id: "crosswalk-inventory", path: "crosswalk-inventory.json" },
	{ id: "relationship-paths", path: "relationship-paths.json" },
	{ id: "relationship-candidates", path: "relationship-candidates.json" },
	{ id: "geography-inventory", path: "geography-inventory.json" },
	{ id: "validation-report", path: "validation-report.json" },
	{ id: "source-inventory", path: "source-inventory.json" },
];

/**
 * Observation artifacts are catalogued per measure source. Deriving them from
 * the data catalogue means adding a source cannot leave a release manifest
 * that pins the description but not the observations it serves.
 */
const cataloguedObservationArtifacts = (
	publicDirectory: string,
): Array<{ id: string; path: string }> => {
	const catalogPath = join(publicDirectory, "data-catalog.json");
	const catalog = JSON.parse(
		readFileSync(catalogPath, "utf8"),
	) as Partial<DataCatalog>;
	if (!Array.isArray(catalog.measures)) return [];
	const artifacts = new Map<string, { id: string; path: string }>();
	for (const measure of catalog.measures) {
		for (const source of measure.sources ?? []) {
			if (isLegacyPopulationSource(measure.id, source)) continue;
			const stem = observationArtifactName(measure.id, source);
			artifacts.set(stem, {
				id: `observations/${stem}`,
				path: `${stem}.json`,
			});
		}
	}
	return [...artifacts.values()].sort((left, right) =>
		left.id.localeCompare(right.id),
	);
};

/** Projection shards are pinned individually, while the inventory selects them. */
const cataloguedLocationProjectionArtifacts = (publicDirectory: string) => {
	const path = join(publicDirectory, "location-projection-inventory.json");
	if (!existsSync(path)) return [];
	const inventory = JSON.parse(readFileSync(path, "utf8")) as {
		shards?: Array<{ crosswalkId?: unknown; artifact?: unknown }>;
	};
	if (!Array.isArray(inventory.shards)) return [];
	return inventory.shards
		.flatMap((shard) =>
			typeof shard.crosswalkId === "string" &&
			typeof shard.artifact === "string"
				? [{ id: `location-projections/${shard.crosswalkId}`, path: shard.artifact }]
				: [],
		)
		.sort((left, right) => left.id.localeCompare(right.id));
};

type Entries = Array<Record<string, unknown>>;

const entriesOf = (value: unknown, key: string): Entries => {
	const list = (value as Record<string, unknown> | null)?.[key];
	return Array.isArray(list)
		? list.filter(
				(entry): entry is Record<string, unknown> =>
					typeof entry === "object" && entry !== null,
			)
		: [];
};

const fingerprints = (
	entries: Entries,
	id: (entry: Record<string, unknown>) => string,
	fingerprint: (entry: Record<string, unknown>) => string = (entry) =>
		sha256(JSON.stringify(entry)),
) =>
	Object.fromEntries(
		entries
			.map((entry) => [id(entry), fingerprint(entry)] as const)
			.sort(([left], [right]) => left.localeCompare(right)),
	);

/** Fingerprints every resource inside the release's artifacts. */
export const releaseResources = (
	publicDirectory: string,
): Record<ResourceKind, Record<string, string>> => {
	const read = (path: string): unknown => {
		const fullPath = join(publicDirectory, path);
		return existsSync(fullPath)
			? JSON.parse(readFileSync(fullPath, "utf8"))
			: undefined;
	};
	const identity = (entry: Record<string, unknown>) =>
		`${String(entry.geography)}/${String(entry.id)}`;
	const catalogue = read("data-catalog.json");
	const validation = read("validation-report.json");
	return {
		datasets: fingerprints(entriesOf(catalogue, "datasets"), (entry) =>
			String(entry.id),
		),
		measures: fingerprints(entriesOf(catalogue, "measures"), (entry) =>
			String(entry.id),
		),
		boundaryReleases: fingerprints(
			entriesOf(read("boundary-releases.json"), "releases"),
			identity,
		),
		areaIdentities: fingerprints(
			entriesOf(read("area-inventory.json"), "releases"),
			identity,
			(entry) =>
				typeof entry.contentHash === "string"
					? entry.contentHash
					: sha256(JSON.stringify(entry)),
		),
		geometrySources: fingerprints(
			entriesOf(read("geometry-sources.json"), "releases"),
			(entry) => String(entry.id),
		),
		crosswalks: fingerprints(
			entriesOf(read("crosswalk-inventory.json"), "crosswalks"),
			(entry) => String(entry.id),
			(entry) => String(entry.contentHash),
		),
		// A waived check is an exception; its finding and its reason are both
		// part of what a reader needs to notice changing.
		validationExceptions: Object.fromEntries(
			entriesOf(validation, "resources")
				.flatMap((resource) =>
					entriesOf(resource, "checks")
						.filter((check) => check.status === "waived")
						.map(
							(check) =>
								[
									`${String(resource.id)} ${String(check.id)}`,
									sha256(
										JSON.stringify({
											detail: check.detail,
											waiver: check.waiver,
										}),
									),
								] as const,
						),
				)
				.sort(([left], [right]) => left.localeCompare(right)),
		),
		namedLocations: fingerprints(
			entriesOf(read("named-locations.json"), "locations"),
			(entry) => String(entry.id),
		),
		exports: fingerprints(
			entriesOf(read("export-manifest.json"), "exports"),
			(entry) => String(entry.id),
		),
		lookups: fingerprints(
			entriesOf(read("lookup-manifest.json"), "lookups"),
			(entry) => String(entry.id),
		),
	};
};

export const createAtlasRelease = (publicDirectory: string): AtlasRelease => {
	const artifactReference = ({ id, path }: { id: string; path: string }) => {
		const fullPath = join(publicDirectory, path);
		if (!existsSync(fullPath)) {
			throw new Error(
				`${id}: build ${path} before building the atlas release manifest`,
			);
		}
		return {
			id,
			path,
			contentHash: sha256(readFileSync(fullPath, "utf8")),
		};
	};
	const artifacts = [
		...RELEASE_ARTIFACTS.map(artifactReference),
		...cataloguedLocationProjectionArtifacts(publicDirectory).map(
			artifactReference,
		),
		...cataloguedObservationArtifacts(publicDirectory).map(
			artifactReference,
		),
	];
	const releaseId = sha256(JSON.stringify({ artifacts }));
	return {
		schemaVersion: 1,
		releaseId,
		artifacts,
		resources: releaseResources(publicDirectory),
	};
};
