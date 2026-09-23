import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	readMeasureObservations,
	readPopulationLocalAuthorityObservations,
	readPopulationObservations,
} from "./observationLoader";
import { createGeographyResolver } from "./geographyResolver";
import { createRelationshipPathIndex } from "./relationshipPaths";
import type { RouteContext } from "./routing";
import {
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
import {
	createLocationProjectionStore,
	createNamedLocations,
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
import { createAreaGeometryCache } from "./geometryLoader";
import {
	createReleaseArtifactReader,
	readAtlasReleaseHistory,
} from "./releaseLoader";
import { createTerrainAsyncProvider } from "./terrainLoader";
import { readRelationshipCandidateInventory } from "./governanceLoader";

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
	const boundaryRegistry = readBoundaryRegistry(apiRoot);
	const areaInventory = readAreaInventory(apiRoot);
	const areaLookup = readAreaLookup(apiRoot, areaInventory);
	const namedLocationInventory = readNamedLocationInventory(apiRoot);
	const crosswalkInventory = readCrosswalkInventory(apiRoot);
	const dataCatalog = readDataCatalog(apiRoot);
	const terrainCatalogue = readTerrainCatalogue(apiRoot);
	const atlasRelease = readAtlasRelease(apiRoot);
	const publicDirectory = join(apiRoot, "public");
	const atlasReleaseHistory = readAtlasReleaseHistory(
		publicDirectory,
		atlasRelease,
	);
	const exportManifest = readExportManifest(apiRoot);
	if (exportManifest.dataCatalogHash !== dataCatalog.contentHash) {
		throw new Error(
			"Export manifest was not built from the current data catalogue.",
		);
	}
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
	const relationshipCandidateInventory = readRelationshipCandidateInventory(apiRoot);
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
	const areaGeometryCache = createAreaGeometryCache(
		apiRoot,
		options.geometryCacheReleases,
	);
	const geographyResolver = createGeographyResolver({
		boundaryRegistry,
		areaInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		areaGeometryCache,
		namedLocationInventory,
		namedLocationLookup,
		locationProjectionStore,
		relationshipPathIndex: createRelationshipPathIndex(
			relationshipPathInventory,
		),
		relationshipCandidateInventory,
	});
	return {
		openapiDocument: readFileSync(resolve(apiRoot, "openapi.yaml"), "utf8"),
		boundaryRegistry,
		geographyInventory: readGeographyInventory(apiRoot),
		areaInventory,
		geographyResolver,
		relationshipPathInventory,
		crosswalkInventory,
		atlasRelease,
		atlasReleaseHistory,
		readReleaseArtifact: createReleaseArtifactReader(
			publicDirectory,
			atlasRelease,
			atlasReleaseHistory,
		),
		relationshipCandidateInventory,
		validationReport: readValidationReport(apiRoot),
		namedLocationInventory,
		locationProjectionInventory,
		locationProjectionStore,
		dataCatalog,
		terrainCatalogue,
		terrainProvider: undefined,
		terrainAsyncProvider: createTerrainAsyncProvider(options),
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
