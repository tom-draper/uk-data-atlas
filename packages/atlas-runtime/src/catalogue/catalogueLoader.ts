import { readAtlasPayload } from "../storage/atlasSqlite";
import { sha256 } from "@uk-data-atlas/artifacts";
import { FullDetailDownloads } from "../areas/fullDetailDownloads";
import type { EvidenceManifest } from "./evidenceDocuments";
import { lazyValue } from "../storage/lazyValue";
import { readAtlasPages } from "../storage/atlasPages";
import { readAtlasLookups } from "../storage/atlasLookups";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { readMeasureObservations } from "./observationLoader";
import {
	createGeographyResolver,
	createGeographyServices,
} from "../areas/geographyResolver";
import { createRelationshipPathIndex } from "@uk-data-atlas/relationships";
import type { AtlasRelease } from "../storage/atlasRelease";
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
} from "../areas/boundaryLoader";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
	readRelationshipPathInventory,
} from "../relationships/crosswalkLoader";
import {
	createLocationProjectionStore,
	createNamedLocations,
	readLocationProjectionInventory,
	readNamedLocationInventory,
} from "../places/locationLoader";
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
import { readMapAssets, readMapResources } from "../maps/mapResourceLoader";
import {
	createAreaGeometryCache,
	readGeometrySources,
} from "../geometry/geometryLoader";
import { createTerrainAsyncProvider } from "@uk-data-atlas/terrain";
import { readRelationshipCandidateInventory } from "./governanceLoader";
import type { StoredFile } from "@uk-data-atlas/artifacts";
import { artifactRoot, repositoryRootOf } from "../storage/dataLayout";

const EVIDENCE_DOCUMENTS = [
	"analysis-geography-validation",
	"geography-inventory",
	"measure-compatibility",
	"relationship-candidates",
	"validation-report",
] as const;

const readEvidenceDocuments = (
	apiRoot: string,
	atlasRelease: AtlasRelease | undefined,
	dataCatalogHash: string,
) => {
	const documents = new Map<
		string,
		StoredFile | { body: string; contentHash: string }
	>(
		EVIDENCE_DOCUMENTS.flatMap<
			[string, StoredFile | { body: string; contentHash: string }]
		>((id) => {
			if (
				id === "geography-inventory" ||
				id === "analysis-geography-validation"
			) {
				const body = readAtlasPayload(repositoryRootOf(apiRoot), id);
				return [[id, { body, contentHash: sha256(body) }]];
			}
			const path = `${id}.json`;
			const artifact = atlasRelease?.artifacts.find(
				(candidate) => candidate.id === id,
			);
			if (!artifact) return [];
			const file = join(artifactRoot(apiRoot), path);
			return [
				[
					id,
					{
						path: file,
						bytes: statSync(file).size,
						contentHash: artifact.contentHash,
					},
				],
			];
		}),
	);
	const indexPath = join(artifactRoot(apiRoot), "evidence-documents.json");
	if (existsSync(indexPath)) {
		const manifest: EvidenceManifest = JSON.parse(
			readFileSync(indexPath, "utf8"),
		);
		if (
			manifest.schemaVersion !== 1 ||
			manifest.dataCatalogHash !== dataCatalogHash ||
			!Array.isArray(manifest.documents)
		)
			throw new Error(
				"Evidence documents were not built from this data catalogue.",
			);
		for (const entry of manifest.documents) {
			if (
				!/^[a-z0-9-]+$/.test(entry.id) ||
				entry.artifact !== `documents/${entry.id}.json`
			)
				throw new Error("Invalid evidence document path");
			const path = join(artifactRoot(apiRoot), entry.artifact);
			if (statSync(path).size !== entry.bytes)
				throw new Error(`Evidence document size mismatch at ${path}`);
			documents.set(entry.id, {
				path,
				bytes: entry.bytes,
				contentHash: entry.contentHash,
			});
		}
	}
	return documents;
};

export type CatalogueOptions = {
	mapAssetBaseUrl?: string;
	mapTileBaseUrl?: string;
	loadEvidenceDocuments?: boolean;
	/** Geometry releases held in memory at once; see `AreaGeometryCache`. */
	geometryCacheReleases?: number;
	crosswalkCacheBytes?: number;
	observationCacheBytes?: number;
	/**
	 * Told before rejecting a compiled geometry release that no longer matches
	 * its registered source.
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

export const readAtlasCatalogues = (
	apiRoot: string,
	options: CatalogueOptions = {},
) => {
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
	const documents = stage("evidence-documents", () =>
		options.loadEvidenceDocuments === false
			? new Map<string, StoredFile>()
			: readEvidenceDocuments(
					apiRoot,
					atlasRelease,
					dataCatalog.contentHash,
				),
	);
	const atlasPages = stage("atlas-pages", () => readAtlasPages(apiRoot));
	const atlasLookups = stage("atlas-lookups", () =>
		readAtlasLookups(apiRoot),
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
		readMapResources(
			apiRoot,
			options.mapAssetBaseUrl,
			options.mapTileBaseUrl,
		),
	);
	const mapAssets = stage("map-assets", () =>
		readMapAssets(apiRoot, mapResources),
	);
	const crosswalkLookup = stage("crosswalk-lookup", () =>
		readCrosswalkLookup(
			apiRoot,
			crosswalkInventory,
			options.crosswalkCacheBytes,
		),
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
		createLocationProjectionStore(apiRoot, locationProjectionInventory),
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
	const placeIndex = lazyValue(() =>
		stage("place-index", () =>
			readPlaceIndex(apiRoot, areaInventory, namedLocationInventory),
		),
	);
	const areaSearchIndex = lazyValue(() =>
		stage("area-search-index", () =>
			readAreaSearchIndex(apiRoot, areaInventory),
		),
	);
	const relationshipPathIndex = stage("relationship-path-index", () =>
		createRelationshipPathIndex(relationshipPathInventory),
	);
	const geographyInputs = {
		boundaryRegistry,
		geographyInventory,
		areaInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		areaGeometryCache,
		namedLocationInventory,
		namedLocationLookup,
		get placeIndex() {
			return placeIndex();
		},
		get areaSearchIndex() {
			return areaSearchIndex();
		},
		postcodeIndex,
		postcodeAreaIndex,
		postcodeCountsIndex,
		locationProjectionStore,
		relationshipPathIndex,
		relationshipCandidateInventory,
	};
	const geographyServices = stage("geography-services", () =>
		createGeographyServices(geographyInputs),
	);
	const geographyResolver = stage("geography-resolver", () =>
		createGeographyResolver(geographyInputs, geographyServices),
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
	const measureObservations = stage("measure-observations", () =>
		readMeasureObservations(
			apiRoot,
			dataCatalog,
			options.observationCacheBytes,
		),
	);
	const measureCompatibilityInventory = stage("measure-compatibility", () =>
		readMeasureCompatibility(apiRoot),
	);
	return {
		boundaryRegistry,
		geographyInventory,
		areaInventory,
		geographyResolver,
		areaValidation: geographyServices.validation,
		postcodes: geographyServices.postcodes,
		areaGeometryCache,
		relationshipPathInventory,
		crosswalkInventory,
		atlasRelease,
		documents,
		atlasLookups,
		atlasPages,
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
		exportFiles: new Map(
			exportManifest.exports.flatMap((entry) =>
				(entry.formats ?? []).map(
					(format) =>
						[
							format.artifact,
							{
								path: join(
									artifactRoot(apiRoot),
									format.artifact,
								),
								bytes: format.bytes,
								contentHash: format.contentHash,
								...(format.gzipBytes === undefined
									? {}
									: { gzipBytes: format.gzipBytes }),
							},
						] as const,
				),
			),
		),
		lookupManifest,
		mapResources,
		...mapAssets,
		fullDetailDownloads: new FullDetailDownloads(
			areaGeometryCache,
			geographyResolver,
		),
		measureObservations,
		measureCompatibilityInventory,
		analysisGeographyInventory,
		analysisGeographyValidationInventory,
	};
};
