import type { AreaInventory } from "./areaInventory";
import type { AtlasRelease } from "./atlasRelease";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type { CrosswalkArtifact } from "./crosswalkTypes";
import type { CrosswalkInventory } from "./crosswalkInventory";
import type { AnyMeasureObservationArtifact, DataCatalog } from "./dataCatalog";
import type { ExportManifest } from "./exportManifest";
import type { GeographyInventory } from "./geographyInventory";
import type { LookupManifest } from "./lookupExports";
import type { FullDetailSource } from "./fullDetailDownloads";
import type { GeographyResolver } from "./geographyResolver";
import type {
	LocationProjectionInventory,
	LocationProjections,
} from "./locationProjections";
import type { MapResources } from "./mapResourceLoader";
import type { MapArchive } from "./mapResource/archiveReader";
import type { MeasureCompatibilityInventory } from "./measureCompatibility";
import type { NamedLocationInventory } from "./namedLocations";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
import type { RelationshipPathInventory } from "./relationshipPaths";
import type { ApiResponse, StoredFile } from "./routeResponse";
import type { ValidationReport } from "./validationReport";
import type { AnalysisGeographyInventory } from "./analysisGeographies";
import type { AnalysisGeographyValidationInventory } from "./analysisGeographyValidation";
import type { TerrainCatalogue } from "./terrainCatalogue";
import type { AsyncTerrainProvider, TerrainProvider } from "./terrainProvider";
import type { OperationMatcher } from "./operationTemplates";

export type { CrosswalkLookup } from "./translation";

/** The independently-built resources available to API route handlers. */
export type RouteContext = {
	boundaryRegistry: BoundaryRegistry;
	geographyInventory?: GeographyInventory;
	/** Each boundary release's identity artifact and its content hash. */
	areaInventory?: AreaInventory;
	crosswalkInventory?: CrosswalkInventory;
	atlasRelease?: AtlasRelease;
	/** Compiled geography indexes and domain operations for this Atlas release. */
	geographyResolver: GeographyResolver;
	relationshipPathInventory?: RelationshipPathInventory;
	relationshipCandidateInventory?: RelationshipCandidateInventory;
	validationReport?: ValidationReport;
	namedLocationInventory?: NamedLocationInventory;
	locationProjectionInventory?: LocationProjectionInventory;
	locationProjectionStore?: LocationProjections;
	dataCatalog?: DataCatalog;
	/** Versioned terrain product definitions and their honest availability. */
	terrainCatalogue?: TerrainCatalogue;
	/** Optional versioned terrain source; absent means no elevation values are published. */
	terrainProvider?: TerrainProvider;
	/** Optional network-backed preview provider; requests are awaited by the HTTP server. */
	terrainAsyncProvider?: AsyncTerrainProvider;
	/** Every measure's observations, one artifact per source partition. */
	measureObservations?: AnyMeasureObservationArtifact[];
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	/** Measure/frame conversions that have passed explicit review. */
	analysisGeographyInventory?: AnalysisGeographyInventory;
	/** Release-pinned evidence that every reviewed conversion conserves values. */
	analysisGeographyValidationInventory?: AnalysisGeographyValidationInventory;
	exportManifest?: ExportManifest;
	exportFiles?: Map<string, StoredFile>;
	/** The OpenAPI description the server serves at `/v1/openapi.yaml`. */
	openapiDocument?: string;
	/**
	 * The compiled OpenAPI operation lookup. Catalogue loading builds it once;
	 * request handling and internal dispatch never need to parse the document.
	 */
	operationMatcher?: OperationMatcher;
	lookupManifest?: LookupManifest;
	/** The boundary releases published as map resources, and their tiles. */
	mapResources?: MapResources;
	/** Each map resource's archive, opened once and keyed by resource id. */
	mapArchives?: Map<string, MapArchive>;
	/** Each map resource tier's GeoParquet file, keyed by its artifact path. */
	mapFeatures?: Map<string, StoredFile>;
	/** Full-tier map downloads, built from the geometry store on request. */
	fullDetailDownloads?: FullDetailSource;
	/** Immutable build artifacts published as evidence documents. */
	documents?: Map<string, StoredFile | { body: string; contentHash: string }>;
	/** The atlas's containment and lineage lookups, by id. */
	atlasLookups?: Map<string, StoredFile>;
	atlasPages?: Map<string, StoredFile>;
};

/** A request body, as sent: its declared media type and its text. */
export type RequestBody = { contentType: string; text: string };

/** A content type without its parameters, such as the charset. */
export const mediaType = (contentType: string) =>
	contentType.split(";", 1)[0]!.trim().toLowerCase();

export type RouteRequest = {
	context: RouteContext;
	/**
	 * POST only for an operation that takes a body, such as a column of codes
	 * too long for a URL; every other request is GET.
	 */
	method?: "GET" | "POST";
	body?: RequestBody;
	releaseId: string;
	parsedUrl: URL;
	segments: string[];
	/**
	 * Serve another GET against the same catalogues, for a route whose answer is
	 * exactly what a more specific route gives when called directly.
	 */
	dispatch: (url: string) => ApiResponse;
};
