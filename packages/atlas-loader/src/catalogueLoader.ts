import { readAreaLookup } from "@uk-data-atlas/areas";
import { readAtlasPayload } from "@uk-data-atlas/catalogue/node";
import { sha256 } from "@uk-data-atlas/artifacts";
import { FullDetailDownloads } from "@uk-data-atlas/geometry";
import type { EvidenceManifest } from "@uk-data-atlas/catalogue/node";
import { lazyValue } from "@uk-data-atlas/atlas-db";
import { readAtlasPages } from "@uk-data-atlas/atlas-db";
import { readAtlasLookups } from "@uk-data-atlas/atlas-db";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	readDataCatalog,
	readMeasureObservations,
} from "@uk-data-atlas/measures";
import {
	createGeographyResolver,
	createGeographyServices,
} from "./geographyResolver.ts";
import { createRelationshipPathIndex } from "@uk-data-atlas/relationships";
import type { AtlasRelease } from "@uk-data-atlas/atlas-db";
import {
	readAreaInventory,
	readAreaSearchIndex,
	readPostcodeAreaIndex,
	readPostcodeCounts,
	readPostcodeIndex,
	readGeographyInventory,
	readPlaceIndex,
	readTerrainCatalogue,
} from "./boundaryLoader.ts";
import { readBoundaryRegistry } from "@uk-data-atlas/catalogue/node";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
	readRelationshipPathInventory,
} from "@uk-data-atlas/relationships";
import {
	createLocationProjectionStore,
	createNamedLocations,
	readLocationProjectionInventory,
	readNamedLocationInventory,
} from "@uk-data-atlas/places";
import {
	readAnalysisGeographyInventory,
	readAnalysisGeographyValidationInventory,
	readAtlasRelease,
	readExportManifest,
	readLookupManifest,
	readMeasureCompatibility,
	readValidationReport,
} from "./catalogueManifestLoader.ts";
import { readMapAssets, readMapResources } from "@uk-data-atlas/map-tiles/node";
import {
	createAreaGeometryCache,
	readGeometrySources,
} from "@uk-data-atlas/geometry";
import { createTerrainAsyncProvider } from "@uk-data-atlas/terrain";
import { readRelationshipCandidateInventory } from "@uk-data-atlas/catalogue/node";
import type { StoredFile } from "@uk-data-atlas/artifacts";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import type { StatisticsReadPath } from "@uk-data-atlas/measures";

const EVIDENCE_DOCUMENTS = [
	"analysis-geography-validation",
	"geography-inventory",
	"measure-compatibility",
	"relationship-candidates",
	"validation-report",
] as const;

const readEvidenceDocuments = (
	repositoryRoot: string,
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
				const body = readAtlasPayload(repositoryRoot, id);
				return [[id, { body, contentHash: sha256(body) }]];
			}
			const path = `${id}.json`;
			const artifact = atlasRelease?.artifacts.find(
				(candidate) => candidate.id === id,
			);
			if (!artifact) return [];
			const file = join(artifactDirectory(repositoryRoot), path);
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
	const indexPath = join(
		artifactDirectory(repositoryRoot),
		"evidence-documents.json",
	);
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
			const path = join(
				artifactDirectory(repositoryRoot),
				entry.artifact,
			);
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
	 * Which observation artifacts are read from the statistics tables. The
	 * API passes its reviewed read path; without one, the build output is read.
	 */
	statisticsReadPath?: StatisticsReadPath;
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
	repositoryRoot: string,
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
		readBoundaryRegistry(repositoryRoot),
	);
	const geographyInventory = stage("geography-inventory", () =>
		readGeographyInventory(repositoryRoot),
	);
	const areaInventory = stage("area-inventory", () =>
		readAreaInventory(repositoryRoot),
	);
	const areaLookup = stage("area-lookup", () =>
		readAreaLookup(repositoryRoot, areaInventory),
	);
	const namedLocationInventory = stage("named-location-inventory", () =>
		readNamedLocationInventory(repositoryRoot),
	);
	const crosswalkInventory = stage("crosswalk-inventory", () =>
		readCrosswalkInventory(repositoryRoot),
	);
	const dataCatalog = stage("data-catalog", () =>
		readDataCatalog(repositoryRoot),
	);
	const terrainCatalogue = stage("terrain-catalogue", () =>
		readTerrainCatalogue(repositoryRoot),
	);
	const atlasRelease = stage("atlas-release", () =>
		readAtlasRelease(repositoryRoot),
	);
	const documents = stage("evidence-documents", () =>
		options.loadEvidenceDocuments === false
			? new Map<string, StoredFile>()
			: readEvidenceDocuments(
					repositoryRoot,
					atlasRelease,
					dataCatalog.contentHash,
				),
	);
	const atlasPages = stage("atlas-pages", () =>
		readAtlasPages(repositoryRoot),
	);
	const atlasLookups = stage("atlas-lookups", () =>
		readAtlasLookups(repositoryRoot),
	);
	const exportManifest = stage("export-manifest", () =>
		readExportManifest(repositoryRoot),
	);
	if (exportManifest.dataCatalogHash !== dataCatalog.contentHash) {
		throw new Error(
			"Export manifest was not built from the current data catalogue.",
		);
	}
	const mapResources = stage("map-resources", () =>
		readMapResources(
			repositoryRoot,
			options.mapAssetBaseUrl,
			options.mapTileBaseUrl,
		),
	);
	const mapAssets = stage("map-assets", () =>
		readMapAssets(repositoryRoot, mapResources),
	);
	const crosswalkLookup = stage("crosswalk-lookup", () =>
		readCrosswalkLookup(
			repositoryRoot,
			crosswalkInventory,
			options.crosswalkCacheBytes,
		),
	);
	const analysisGeographyInventory = stage(
		"analysis-geography-inventory",
		() =>
			readAnalysisGeographyInventory(
				repositoryRoot,
				dataCatalog,
				crosswalkInventory,
			),
	);
	const analysisGeographyValidationInventory = stage(
		"analysis-geography-validation-inventory",
		() =>
			readAnalysisGeographyValidationInventory(
				repositoryRoot,
				analysisGeographyInventory,
				dataCatalog,
				crosswalkInventory,
			),
	);
	const relationshipPathInventory = stage("relationship-path-inventory", () =>
		readRelationshipPathInventory(repositoryRoot, crosswalkInventory),
	);
	const relationshipCandidateInventory = stage(
		"relationship-candidate-inventory",
		() => readRelationshipCandidateInventory(repositoryRoot),
	);
	const namedLocationLookup = stage("named-location-lookup", () =>
		createNamedLocations(namedLocationInventory),
	);
	const locationProjectionInventory = stage(
		"location-projection-inventory",
		() =>
			readLocationProjectionInventory(
				repositoryRoot,
				namedLocationInventory,
				crosswalkInventory,
			),
	);
	const locationProjectionStore = stage("location-projection-store", () =>
		createLocationProjectionStore(
			repositoryRoot,
			locationProjectionInventory,
		),
	);
	const postcodeIndex = stage("postcode-index", () =>
		readPostcodeIndex(repositoryRoot),
	);
	const geometrySources = stage("geometry-sources", () =>
		readGeometrySources(repositoryRoot),
	);
	const postcodeAreaIndex = stage("postcode-area-index", () =>
		readPostcodeAreaIndex(
			repositoryRoot,
			postcodeIndex,
			areaInventory,
			geometrySources,
		),
	);
	const postcodeCountsIndex = stage("postcode-counts", () =>
		readPostcodeCounts(repositoryRoot, postcodeIndex, postcodeAreaIndex),
	);
	const areaGeometryCache = stage("area-geometry-cache", () =>
		createAreaGeometryCache(
			repositoryRoot,
			options.geometryCacheReleases,
			options.onStaleCompiledGeometry,
		),
	);
	const placeIndex = lazyValue(() =>
		stage("place-index", () =>
			readPlaceIndex(
				repositoryRoot,
				areaInventory,
				namedLocationInventory,
			),
		),
	);
	const areaSearchIndex = lazyValue(() =>
		stage("area-search-index", () =>
			readAreaSearchIndex(repositoryRoot, areaInventory),
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
		readValidationReport(repositoryRoot),
	);
	const terrainAsyncProvider = stage("terrain-async-provider", () =>
		createTerrainAsyncProvider(options),
	);
	const lookupManifest = stage("lookup-manifest", () =>
		readLookupManifest(repositoryRoot),
	);
	const measureObservations = stage("measure-observations", () =>
		readMeasureObservations(
			repositoryRoot,
			dataCatalog,
			options.observationCacheBytes,
			options.statisticsReadPath,
		),
	);
	const measureCompatibilityInventory = stage("measure-compatibility", () =>
		readMeasureCompatibility(repositoryRoot),
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
			[
				...exportManifest.exports,
				...(exportManifest.measureExports ?? []),
			].flatMap((entry) =>
				(entry.formats ?? []).map(
					(format) =>
						[
							format.artifact,
							{
								path: join(
									artifactDirectory(repositoryRoot),
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
