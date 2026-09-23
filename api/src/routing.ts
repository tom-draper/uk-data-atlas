import type { AreaInventory } from "./areaInventory";
import type { AtlasRelease, AtlasReleaseArtifactRef } from "./atlasRelease";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
	PopulationLocalAuthorityObservationArtifact,
	PopulationObservationArtifact,
} from "./dataCatalog";
import type { ExportManifest } from "./exportManifest";
import type { GeographyInventory } from "./geographyInventory";
import type { LookupManifest } from "./lookupExports";
import type { GeographyResolver } from "./geographyResolver";
import type {
	LocationProjectionInventory,
	LocationProjectionStore,
} from "./locationProjections";
import type { MapResourceDescriptor } from "./mapResource/compileMapResource";
import type { MapArchive } from "./mapResource/archiveReader";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";
import type { NamedLocationInventory } from "./namedLocations";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
import type { RelationshipPathInventory } from "./relationshipPaths";
import type { ApiResponse } from "./routeResponse";
import type { ValidationReport } from "./validationReport";
import type { AnalysisGeographyInventory } from "./analysisGeographies";
import type { AnalysisGeographyValidationInventory } from "./analysisGeographyValidation";
import type { TerrainCatalogue } from "./terrainCatalogue";
import type { AsyncTerrainProvider, TerrainProvider } from "./terrainProvider";

export type CrosswalkLookup = Map<string, CrosswalkArtifact>;

/** The independently-built resources available to API route handlers. */
export type RouteContext = {
	boundaryRegistry: BoundaryRegistry;
	geographyInventory?: GeographyInventory;
	/** Each boundary release's identity artifact and its content hash. */
	areaInventory?: AreaInventory;
	crosswalkInventory?: CrosswalkInventory;
	atlasRelease?: AtlasRelease;
	atlasReleaseHistory?: Map<string, AtlasRelease>;
	/** Read bytes from an immutable current or archived release artifact. */
	readReleaseArtifact?: (
		releaseId: string,
		artifactId: string,
	) => { artifact: AtlasReleaseArtifactRef; body: Buffer } | undefined;
	/** Compiled geography indexes and domain operations for this Atlas release. */
	geographyResolver: GeographyResolver;
	relationshipPathInventory?: RelationshipPathInventory;
	relationshipCandidateInventory?: RelationshipCandidateInventory;
	validationReport?: ValidationReport;
	namedLocationInventory?: NamedLocationInventory;
	locationProjectionInventory?: LocationProjectionInventory;
	locationProjectionStore?: LocationProjectionStore;
	dataCatalog?: DataCatalog;
	/** Versioned terrain product definitions and their honest availability. */
	terrainCatalogue?: TerrainCatalogue;
	/** Optional versioned terrain source; absent means no elevation values are published. */
	terrainProvider?: TerrainProvider;
	/** Optional network-backed preview provider; requests are awaited by the HTTP server. */
	terrainAsyncProvider?: AsyncTerrainProvider;
	populationObservations?: PopulationObservationArtifact;
	populationLocalAuthorityObservations?: PopulationLocalAuthorityObservationArtifact;
	/** Every measure's observations bar the two population artifacts. */
	measureObservations?: AnyMeasureObservationArtifact[];
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	/** Measure/frame conversions that have passed explicit review. */
	analysisGeographyInventory?: AnalysisGeographyInventory;
	/** Release-pinned evidence that every reviewed conversion conserves values. */
	analysisGeographyValidationInventory?: AnalysisGeographyValidationInventory;
	exportManifest?: ExportManifest;
	/** The OpenAPI description the server serves at `/v1/openapi.yaml`. */
	openapiDocument?: string;
	lookupManifest?: LookupManifest;
	/** The boundary releases published as map resources, and their tiles. */
	mapResources?: { resources: MapResourceDescriptor[] };
	/** Each map resource's archive, opened once and keyed by resource id. */
	mapArchives?: Map<string, MapArchive>;
	/** Each map resource tier's GeoParquet file, keyed by its artifact path. */
	mapFeatures?: Map<string, Buffer>;
};

/** Route handlers always use the eagerly constructed facade on their context. */
export const geographyResolverFor = (context: RouteContext): GeographyResolver =>
	context.geographyResolver;

export type RouteRequest = {
	context: RouteContext;
	releaseId: string;
	parsedUrl: URL;
	segments: string[];
	/**
	 * Serve another GET against the same catalogues, for a route whose answer is
	 * exactly what a more specific route gives when called directly.
	 */
	dispatch: (url: string) => ApiResponse;
	/**
	 * The Atlas release this request was pinned to, where it was asked for
	 * under `/v1/atlas-releases/{release-id}/`. A route uses it to build links
	 * that stay pinned, so a client that pinned once does not fall back to a
	 * revalidated URL on its next hop.
	 */
	pinnedTo?: string;
};
