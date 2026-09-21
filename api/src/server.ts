import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	readArchivedAtlasReleaseArtifact,
	readArchivedAtlasReleases,
	readAtlasReleaseArtifact,
} from "./atlasReleaseHistory";
import { AreaGeometryCache, type GeometrySourceLookup } from "./areaGeometry";
import { readGeometrySourceLookup } from "./geometrySources";
import type { CrosswalkInventory } from "./crosswalkInventory";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
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
import { createGeographyResolver } from "./geographyResolver";
import { createRelationshipPathIndex } from "./relationshipPaths";
import type { RouteContext } from "./routing";
import { createRemoteTerrainProvider } from "./terrainProvider";
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

import {
	readCrosswalkInventory,
	readCrosswalkLookup,
	readRelationshipPathInventory,
} from "./crosswalkLoader";
export {
	readCrosswalkInventory,
	readCrosswalkLookup,
	readRelationshipPathInventory,
} from "./crosswalkLoader";
import {
	createLocationProjectionStore,
	createNamedLocations,
	readLocationProjectionInventory,
	readNamedLocationInventory,
} from "./locationLoader";
export {
	readLocationProjectionInventory,
	readNamedLocationInventory,
} from "./locationLoader";
import {
	readAnalysisGeographyInventory,
	readAnalysisGeographyValidationInventory,
	readAtlasRelease,
	readDataCatalog,
	readExportManifest,
	readLookupManifest,
	readMeasureCompatibility,
	readValidationReport,
} from "./catalogueManifestLoader";
import { readMapAssets, readMapResources } from "./mapResourceLoader";
export {
	readAnalysisGeographyInventory,
	readAnalysisGeographyValidationInventory,
	readAtlasRelease,
	readDataCatalog,
	readExportManifest,
	readLookupManifest,
	readMeasureCompatibility,
	readValidationReport,
} from "./catalogueManifestLoader";

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
	const mapAssets = readMapAssets(apiRoot, mapResources);
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
	const namedLocationLookup = createNamedLocations(namedLocationInventory);
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
		...mapAssets,
		populationObservations: readPopulationObservations(apiRoot),
		populationLocalAuthorityObservations:
			readPopulationLocalAuthorityObservations(apiRoot),
		measureObservations: readMeasureObservations(apiRoot, dataCatalog),
		measureCompatibilityInventory: readMeasureCompatibility(apiRoot),
		analysisGeographyInventory,
		analysisGeographyValidationInventory,
	};
};

export { createApiServer, type ApiServer } from "./apiServer";
