import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
	readAreaSearchIndex,
	readPostcodeAreaIndex,
	readPostcodeCounts,
	readPostcodeIndex,
	readBoundaryRegistry,
	readGeographyInventory,
	readPlaceIndex,
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
	readOperations,
	readValidationReport,
} from "./catalogueManifestLoader";
import { readMapAssets, readMapResources } from "./mapResourceLoader";
import { createAreaGeometryCache, readGeometrySources } from "./geometryLoader";
import { createTerrainAsyncProvider } from "./terrainLoader";
import { readRelationshipCandidateInventory } from "./governanceLoader";
import { createOperationMatcher } from "./operationTemplates";

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
	/**
	 * Told when a compiled geometry release no longer matches its source, so
	 * the release is read from the source instead.
	 */
	onStaleCompiledGeometry?: (release: string, path: string) => void;
	/** Enables the non-persistent EA remote preview provider when set. */
	terrainRemoteEndpoint?: string;
	terrainCoverageEndpoint?: string;
	terrainRemoteTimeoutMs?: number;
	terrainRemoteConcurrency?: number;
	/**
	 * Receives optional catalogue-load timings. Normal serving does not retain
	 * them or pay for timing each stage.
	 */
	onStage?: (stage: string, milliseconds: number) => void;
};

export const readApiCatalogues = (
	apiRoot: string,
	options: CatalogueOptions = {},
): ApiCatalogues => {
	const stage = <T>(name: string, read: () => T): T => {
		if (!options.onStage) return read();
		const started = performance.now();
		const value = read();
		options.onStage(name, performance.now() - started);
		return value;
	};
	const boundaryRegistry = stage("boundary-registry", () =>
		readBoundaryRegistry(apiRoot),
	);
	const geographyInventory = stage("geography-inventory", () =>
		readGeographyInventory(apiRoot),
	);
	const areaInventory = stage("area-inventory", () =>
		readAreaInventory(apiRoot),
	);
	const areaLookup = stage("area-lookup", () =>
		readAreaLookup(apiRoot, areaInventory),
	);
	const namedLocationInventory = stage("named-location-inventory", () =>
		readNamedLocationInventory(apiRoot),
	);
	const crosswalkInventory = stage("crosswalk-inventory", () =>
		readCrosswalkInventory(apiRoot),
	);
	const dataCatalog = stage("data-catalog", () => readDataCatalog(apiRoot));
	const terrainCatalogue = stage("terrain-catalogue", () =>
		readTerrainCatalogue(apiRoot),
	);
	const atlasRelease = stage("atlas-release", () =>
		readAtlasRelease(apiRoot),
	);
	const exportManifest = stage("export-manifest", () =>
		readExportManifest(apiRoot),
	);
	if (exportManifest.dataCatalogHash !== dataCatalog.contentHash) {
		throw new Error(
			"Export manifest was not built from the current data catalogue.",
		);
	}
	const mapResources = stage("map-resources", () =>
		readMapResources(apiRoot),
	);
	const mapAssets = stage("map-assets", () =>
		readMapAssets(apiRoot, mapResources),
	);
	const crosswalkLookup = stage("crosswalk-lookup", () =>
		readCrosswalkLookup(apiRoot, crosswalkInventory),
	);
	const analysisGeographyInventory = stage(
		"analysis-geography-inventory",
		() =>
			readAnalysisGeographyInventory(
				apiRoot,
				dataCatalog,
				crosswalkInventory,
			),
	);
	const analysisGeographyValidationInventory = stage(
		"analysis-geography-validation-inventory",
		() =>
			readAnalysisGeographyValidationInventory(
				apiRoot,
				analysisGeographyInventory,
				dataCatalog,
				crosswalkInventory,
			),
	);
	const relationshipPathInventory = stage("relationship-path-inventory", () =>
		readRelationshipPathInventory(apiRoot, crosswalkInventory),
	);
	const relationshipCandidateInventory = stage(
		"relationship-candidate-inventory",
		() => readRelationshipCandidateInventory(apiRoot),
	);
	const namedLocationLookup = stage("named-location-lookup", () =>
		createNamedLocations(namedLocationInventory),
	);
	const locationProjectionInventory = stage(
		"location-projection-inventory",
		() =>
			readLocationProjectionInventory(
				apiRoot,
				namedLocationInventory,
				crosswalkInventory,
			),
	);
	const locationProjectionStore = stage("location-projection-store", () =>
		createLocationProjectionStore(
			apiRoot,
			locationProjectionInventory,
			namedLocationInventory,
			crosswalkInventory,
		),
	);
	const postcodeIndex = stage("postcode-index", () =>
		readPostcodeIndex(apiRoot),
	);
	const geometrySources = stage("geometry-sources", () =>
		readGeometrySources(apiRoot),
	);
	const postcodeAreaIndex = stage("postcode-area-index", () =>
		readPostcodeAreaIndex(
			apiRoot,
			postcodeIndex,
			areaInventory,
			geometrySources,
		),
	);
	const postcodeCountsIndex = stage("postcode-counts", () =>
		readPostcodeCounts(apiRoot, postcodeIndex, postcodeAreaIndex),
	);
	const areaGeometryCache = stage("area-geometry-cache", () =>
		createAreaGeometryCache(
			apiRoot,
			options.geometryCacheReleases,
			options.onStaleCompiledGeometry,
		),
	);
	const placeIndex = stage("place-index", () =>
		readPlaceIndex(apiRoot, areaInventory, namedLocationInventory),
	);
	const areaSearchIndex = stage("area-search-index", () =>
		readAreaSearchIndex(apiRoot, areaInventory),
	);
	const relationshipPathIndex = stage("relationship-path-index", () =>
		createRelationshipPathIndex(relationshipPathInventory),
	);
	const geographyResolver = stage("geography-resolver", () =>
		createGeographyResolver({
			boundaryRegistry,
			geographyInventory,
			areaInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			areaGeometryCache,
			namedLocationInventory,
			namedLocationLookup,
			placeIndex,
			areaSearchIndex,
			postcodeIndex,
			postcodeAreaIndex,
			postcodeCountsIndex,
			locationProjectionStore,
			relationshipPathIndex,
			relationshipCandidateInventory,
		}),
	);
	const openapiDocument = stage("openapi-document", () =>
		readFileSync(resolve(apiRoot, "openapi.yaml"), "utf8"),
	);
	const operationMatcher = stage("openapi-operation-matcher", () =>
		createOperationMatcher(
			readOperations(apiRoot, openapiDocument).operations,
		),
	);
	const validationReport = stage("validation-report", () =>
		readValidationReport(apiRoot),
	);
	const terrainAsyncProvider = stage("terrain-async-provider", () =>
		createTerrainAsyncProvider(options),
	);
	const lookupManifest = stage("lookup-manifest", () =>
		readLookupManifest(apiRoot),
	);
	const populationObservations = stage("population-observations", () =>
		readPopulationObservations(apiRoot),
	);
	const populationLocalAuthorityObservations = stage(
		"population-local-authority-observations",
		() => readPopulationLocalAuthorityObservations(apiRoot),
	);
	const measureObservations = stage("measure-observations", () =>
		readMeasureObservations(apiRoot, dataCatalog),
	);
	const measureCompatibilityInventory = stage("measure-compatibility", () =>
		readMeasureCompatibility(apiRoot),
	);
	return {
		openapiDocument,
		operationMatcher,
		boundaryRegistry,
		geographyInventory,
		areaInventory,
		geographyResolver,
		relationshipPathInventory,
		crosswalkInventory,
		atlasRelease,
		relationshipCandidateInventory,
		validationReport,
		namedLocationInventory,
		locationProjectionInventory,
		locationProjectionStore,
		dataCatalog,
		terrainCatalogue,
		terrainProvider: undefined,
		terrainAsyncProvider,
		exportManifest,
		lookupManifest,
		mapResources,
		...mapAssets,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
		measureCompatibilityInventory,
		analysisGeographyInventory,
		analysisGeographyValidationInventory,
	};
};
