import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AtlasRelease } from "./atlasRelease";
import {
	readArchivedAtlasReleaseArtifact,
	readArchivedAtlasReleases,
	readAtlasReleaseArtifact,
} from "./atlasReleaseHistory";
import { AreaGeometryCache, type GeometrySourceLookup } from "./areaGeometry";
import { readGeometrySourceLookup } from "./geometrySources";
import { openArchive } from "./mapResource/archiveReader";
import type { MapResourceDescriptor } from "./mapResource/compileMapResource";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
import {
	createNamedLocationLookup,
	type NamedLocationInventory,
	type NamedLocationLookup,
} from "./namedLocations";
import type { ValidationReport } from "./validationReport";
import { type DataCatalog } from "./dataCatalog";
import {
	readMeasureObservations,
	readPopulationLocalAuthorityObservations,
	readPopulationObservations,
} from "./observationLoader";
export {
	readMeasureObservations,
	readPopulationLocalAuthorityObservations,
	readPopulationObservations,
} from "./observationLoader";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";
import type { ExportManifest } from "./exportManifest";
import type { LookupManifest } from "./lookupExports";
import { createGeographyResolver } from "./geographyResolver";
import {
	LocationProjectionStore,
	type LocationParentProjectionArtifact,
	LocationProjectionArtifact,
	type LocationProjectionInventory,
} from "./locationProjections";
import type { CrosswalkLookup, RouteContext } from "./routing";
import {
	createRelationshipPathIndex,
	type RelationshipPathInventory,
} from "./relationshipPaths";
import type { AnalysisGeographyInventory } from "./analysisGeographies";
import type { AnalysisGeographyValidationInventory } from "./analysisGeographyValidation";
import { createRemoteTerrainProvider } from "./terrainProvider";
import { withUnitDefinitions } from "./unitRegistry";
import {
	readAreaInventory,
	readAreaLookup,
	readBoundaryRegistry,
	readGeographyInventory,
	readTerrainCatalogue,
} from "./boundaryLoader";
export {
	readAreaInventory,
	readAreaLookup,
	readBoundaryRegistry,
	readGeographyInventory,
	readTerrainCatalogue,
} from "./boundaryLoader";

export const readCrosswalkInventory = (apiRoot: string): CrosswalkInventory => {
	const path = join(apiRoot, "public", "crosswalk-inventory.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as CrosswalkInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.crosswalks)) {
		throw new Error(`Invalid crosswalk inventory at ${path}`);
	}
	return inventory;
};

export const readCrosswalkLookup = (
	apiRoot: string,
	inventory: CrosswalkInventory,
): CrosswalkLookup =>
	new Map(
		inventory.crosswalks.map((crosswalk) => {
			const path = join(apiRoot, "public", crosswalk.artifact);
			const artifact = JSON.parse(
				readFileSync(path, "utf8"),
			) as CrosswalkArtifact;
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== crosswalk.contentHash ||
				!Array.isArray(artifact.records)
			) {
				throw new Error(`Invalid crosswalk artifact at ${path}`);
			}
			return [crosswalk.id, artifact];
		}),
	);

export const readAtlasRelease = (apiRoot: string): AtlasRelease => {
	const path = join(apiRoot, "public", "atlas-release.json");
	const release = JSON.parse(readFileSync(path, "utf8")) as AtlasRelease;
	if (release.schemaVersion !== 1 || !Array.isArray(release.artifacts)) {
		throw new Error(`Invalid atlas release manifest at ${path}`);
	}
	return release;
};

export const readRelationshipCandidateInventory = (
	apiRoot: string,
): RelationshipCandidateInventory => {
	const path = join(apiRoot, "public", "relationship-candidates.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as RelationshipCandidateInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.candidates)) {
		throw new Error(`Invalid relationship candidate inventory at ${path}`);
	}
	return inventory;
};

export const readNamedLocationInventory = (
	apiRoot: string,
): NamedLocationInventory => {
	const path = join(apiRoot, "public", "named-locations.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as NamedLocationInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.locations)) {
		throw new Error(`Invalid named location inventory at ${path}`);
	}
	return inventory;
};

export const readLocationProjectionInventory = (
	apiRoot: string,
	namedLocations: NamedLocationInventory,
	crosswalkInventory: CrosswalkInventory,
): LocationProjectionInventory => {
	const path = join(apiRoot, "public", "location-projection-inventory.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as LocationProjectionInventory;
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.shards) ||
		inventory.namedLocationInventoryHash !== namedLocations.contentHash ||
		inventory.crosswalkInventoryHash !== crosswalkInventory.contentHash
	) {
		throw new Error(`Invalid location projection inventory at ${path}`);
	}
	return inventory;
};

export const readRelationshipPathInventory = (
	apiRoot: string,
	crosswalks: CrosswalkInventory,
): RelationshipPathInventory => {
	const path = join(apiRoot, "public", "relationship-paths.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as RelationshipPathInventory;
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.paths) ||
		inventory.crosswalkInventoryHash !== crosswalks.contentHash
	) {
		throw new Error(`Invalid relationship path inventory at ${path}`);
	}
	return inventory;
};

const createLocationProjectionStore = (
	apiRoot: string,
	inventory: LocationProjectionInventory,
	namedLocations: NamedLocationInventory,
	crosswalkInventory: CrosswalkInventory,
) =>
	new LocationProjectionStore(
		inventory,
		(shard) => {
			const path = join(apiRoot, "public", shard.artifact);
			const artifact = JSON.parse(
				readFileSync(path, "utf8"),
			) as LocationProjectionArtifact;
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== shard.contentHash ||
				artifact.crosswalkId !== shard.crosswalkId ||
				artifact.namedLocationInventoryHash !==
					namedLocations.contentHash ||
				artifact.crosswalkInventoryHash !==
					crosswalkInventory.contentHash ||
				!Array.isArray(artifact.projections)
			) {
				throw new Error(`Invalid location projection shard at ${path}`);
			}
			return artifact;
		},
		(shard) => {
			const path = join(apiRoot, "public", shard.artifact);
			const artifact = JSON.parse(
				readFileSync(path, "utf8"),
			) as LocationParentProjectionArtifact;
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== shard.contentHash ||
				artifact.crosswalkId !== shard.crosswalkId ||
				artifact.namedLocationInventoryHash !==
					namedLocations.contentHash ||
				artifact.crosswalkInventoryHash !==
					crosswalkInventory.contentHash ||
				!Array.isArray(artifact.parentProjections)
			) {
				throw new Error(
					`Invalid location parent projection shard at ${path}`,
				);
			}
			return artifact;
		},
	);

export const readValidationReport = (apiRoot: string): ValidationReport => {
	const path = join(apiRoot, "public", "validation-report.json");
	const report = JSON.parse(readFileSync(path, "utf8")) as ValidationReport;
	if (report.schemaVersion !== 1 || !Array.isArray(report.resources)) {
		throw new Error(`Invalid validation report at ${path}`);
	}
	return report;
};

export const readDataCatalog = (apiRoot: string): DataCatalog => {
	const path = join(apiRoot, "public", "data-catalog.json");
	const catalog = JSON.parse(readFileSync(path, "utf8")) as DataCatalog;
	if (
		catalog.schemaVersion !== 1 ||
		!Array.isArray(catalog.datasets) ||
		!Array.isArray(catalog.measures)
	) {
		throw new Error(`Invalid data catalogue at ${path}`);
	}
	return withUnitDefinitions(catalog);
};

export const readExportManifest = (apiRoot: string): ExportManifest => {
	const path = join(apiRoot, "public", "export-manifest.json");
	const manifest = JSON.parse(readFileSync(path, "utf8")) as ExportManifest;
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.exports)) {
		throw new Error(`Invalid export manifest at ${path}`);
	}
	return manifest;
};

export const readLookupManifest = (apiRoot: string): LookupManifest => {
	const path = join(apiRoot, "public", "lookup-manifest.json");
	const manifest = JSON.parse(readFileSync(path, "utf8")) as LookupManifest;
	if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.lookups)) {
		throw new Error(`Invalid lookup manifest at ${path}`);
	}
	return manifest;
};

export const readMeasureCompatibility = (
	apiRoot: string,
): MeasureCompatibilityInventory => {
	const path = join(apiRoot, "public", "measure-compatibility.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as MeasureCompatibilityInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.measures)) {
		throw new Error(`Invalid measure compatibility inventory at ${path}`);
	}
	return inventory;
};

export const readAnalysisGeographyInventory = (
	apiRoot: string,
	dataCatalog: DataCatalog,
	crosswalkInventory: CrosswalkInventory,
): AnalysisGeographyInventory => {
	const path = join(apiRoot, "public", "analysis-geographies.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as AnalysisGeographyInventory;
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.supports) ||
		inventory.dataCatalogHash !== dataCatalog.contentHash ||
		inventory.crosswalkInventoryHash !== crosswalkInventory.contentHash
	) {
		throw new Error(`Invalid analysis geography inventory at ${path}`);
	}
	return inventory;
};

export const readAnalysisGeographyValidationInventory = (
	apiRoot: string,
	analysisGeographies: AnalysisGeographyInventory,
	dataCatalog: DataCatalog,
	crosswalkInventory: CrosswalkInventory,
): AnalysisGeographyValidationInventory => {
	const path = join(apiRoot, "public", "analysis-geography-validation.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as AnalysisGeographyValidationInventory;
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.supports) ||
		inventory.analysisGeographyInventoryHash !==
			analysisGeographies.contentHash ||
		inventory.dataCatalogHash !== dataCatalog.contentHash ||
		inventory.crosswalkInventoryHash !== crosswalkInventory.contentHash
	) {
		throw new Error(
			`Invalid analysis geography validation inventory at ${path}`,
		);
	}
	return inventory;
};

export type ApiCatalogues = Omit<
	Required<RouteContext>,
	"terrainProvider" | "terrainAsyncProvider"
> & {
	terrainProvider?: RouteContext["terrainProvider"];
	terrainAsyncProvider?: RouteContext["terrainAsyncProvider"];
};

export type CatalogueOptions = {
	/** Geometry releases held in memory at once; see `AreaGeometryCache`. */
	geometryCacheReleases?: number;
	/** Enables the non-persistent EA remote preview provider when set. */
	terrainRemoteEndpoint?: string;
	terrainCoverageEndpoint?: string;
	terrainRemoteTimeoutMs?: number;
	terrainRemoteConcurrency?: number;
};

export const readApiCatalogues = (
	apiRoot: string,
	options: CatalogueOptions = {},
): ApiCatalogues => {
	const areaInventory = readAreaInventory(apiRoot);
	const areaLookup = readAreaLookup(apiRoot, areaInventory);
	const namedLocationInventory = readNamedLocationInventory(apiRoot);
	const crosswalkInventory = readCrosswalkInventory(apiRoot);
	const dataCatalog = readDataCatalog(apiRoot);
	const terrainCatalogue = readTerrainCatalogue(apiRoot);
	const atlasRelease = readAtlasRelease(apiRoot);
	const publicDirectory = join(apiRoot, "public");
	const atlasReleaseHistory = new Map(
		[...readArchivedAtlasReleases(publicDirectory), atlasRelease].map(
			(release) => [release.releaseId, release],
		),
	);
	const exportManifest = readExportManifest(apiRoot);
	if (exportManifest.dataCatalogHash !== dataCatalog.contentHash) {
		throw new Error(
			"Export manifest was not built from the current data catalogue.",
		);
	}
	const geometrySources = readGeometrySourceLookup(apiRoot);
	const mapResources = readMapResources(apiRoot);
	const crosswalkLookup = readCrosswalkLookup(apiRoot, crosswalkInventory);
	const analysisGeographyInventory = readAnalysisGeographyInventory(
		apiRoot,
		dataCatalog,
		crosswalkInventory,
	);
	const analysisGeographyValidationInventory =
		readAnalysisGeographyValidationInventory(
			apiRoot,
			analysisGeographyInventory,
			dataCatalog,
			crosswalkInventory,
		);
	const relationshipPathInventory = readRelationshipPathInventory(
		apiRoot,
		crosswalkInventory,
	);
	const namedLocationLookup = createNamedLocationLookup(
		namedLocationInventory,
	);
	const locationProjectionInventory = readLocationProjectionInventory(
		apiRoot,
		namedLocationInventory,
		crosswalkInventory,
	);
	const locationProjectionStore = createLocationProjectionStore(
		apiRoot,
		locationProjectionInventory,
		namedLocationInventory,
		crosswalkInventory,
	);
	const areaGeometryCache = new AreaGeometryCache(
		resolve(apiRoot, ".."),
		geometrySources,
		options.geometryCacheReleases,
	);
	const geographyResolver = createGeographyResolver({
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		areaGeometryCache,
		namedLocationLookup,
		locationProjectionStore,
		relationshipPathIndex: createRelationshipPathIndex(
			relationshipPathInventory,
		),
	});
	return {
		openapiDocument: readFileSync(resolve(apiRoot, "openapi.yaml"), "utf8"),
		boundaryRegistry: readBoundaryRegistry(apiRoot),
		geographyInventory: readGeographyInventory(apiRoot),
		areaInventory,
		areaLookup,
		geographyResolver,
		relationshipPathInventory,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		atlasReleaseHistory,
		readReleaseArtifact: (requestedReleaseId, artifactId) => {
			const release = atlasReleaseHistory.get(requestedReleaseId);
			if (!release) return undefined;
			return requestedReleaseId === atlasRelease.releaseId
				? readAtlasReleaseArtifact(publicDirectory, release, artifactId)
				: readArchivedAtlasReleaseArtifact(
						publicDirectory,
						release,
						artifactId,
					);
		},
		relationshipCandidateInventory:
			readRelationshipCandidateInventory(apiRoot),
		validationReport: readValidationReport(apiRoot),
		namedLocationInventory,
		namedLocationLookup,
		locationProjectionInventory,
		locationProjectionStore,
		dataCatalog,
		terrainCatalogue,
		terrainProvider: undefined,
		terrainAsyncProvider: options.terrainRemoteEndpoint
			? createRemoteTerrainProvider({
					endpoint: options.terrainRemoteEndpoint,
					coverageEndpoint: options.terrainCoverageEndpoint,
					timeoutMs: options.terrainRemoteTimeoutMs,
					maxConcurrent: options.terrainRemoteConcurrency,
					source: {
						id: "ea-lidar-composite-dtm-2m",
						version: "remote-preview",
						provenance: "remote-preview",
						crs: "EPSG:27700",
						horizontalDatum: "OSGB36",
						horizontalTransformation: "OSTN15",
						verticalDatum: "ODN",
						verticalModel: "OSGM15",
						resolutionMetres: 2,
						noData: -3.4028235e38,
						uncertainty: { metric: "rmse", valueMetres: 0.15 },
						coverage: {
							kind: "bbox",
							bbox: [80000, 4000, 658081.8635, 666000],
							footprintHash: "remote-ea-2022-coverage",
						},
					},
				})
			: undefined,
		exportManifest,
		lookupManifest: readLookupManifest(apiRoot),
		mapResources,
		mapArchives: new Map(
			mapResources.resources.map((resource) => [
				resource.id,
				openArchive(join(apiRoot, "public", resource.tiles.artifact)),
			]),
		),
		mapFeatures: new Map(
			mapResources.resources.flatMap((resource) =>
				(resource.features ?? []).map((entry) => [
					entry.artifact,
					readFileSync(join(apiRoot, "public", entry.artifact)),
				]),
			),
		),
		populationObservations: readPopulationObservations(apiRoot),
		populationLocalAuthorityObservations:
			readPopulationLocalAuthorityObservations(apiRoot),
		measureObservations: readMeasureObservations(apiRoot, dataCatalog),
		measureCompatibilityInventory: readMeasureCompatibility(apiRoot),
		analysisGeographyInventory,
		analysisGeographyValidationInventory,
	};
};

/**
 * The published map resources, when there are any. A server built without them
 * still serves everything else, and the map routes answer that the resource is
 * not published rather than the server failing to start.
 */
const readMapResources = (apiRoot: string) => {
	const path = join(apiRoot, "public", "map-resources.json");
	if (!existsSync(path)) return { resources: [] };
	return JSON.parse(readFileSync(path, "utf8")) as {
		resources: MapResourceDescriptor[];
	};
};

export { createApiServer, type ApiServer } from "./apiServer";
