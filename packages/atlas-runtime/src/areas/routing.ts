import type { AreaInventory } from "./areaInventory";
import type { AtlasRelease } from "../storage/atlasRelease";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import type { CrosswalkArtifact } from "../relationships/crosswalkTypes";
import type { CrosswalkInventory } from "../relationships/crosswalkInventory";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
} from "../catalogue/dataCatalog";
import type { ExportManifest } from "../storage/exportManifest";
import type { GeographyInventory } from "./geographyInventory";
import type { LookupManifest } from "./lookupExports";
import type { FullDetailSource } from "./fullDetailDownloads";
import type { GeographyResolver } from "./geographyResolver";
import type {
	LocationProjectionInventory,
	LocationProjections,
} from "../places/locationProjections";
import type { MapResources } from "@uk-data-atlas/map-tiles/mapResources";
import type { MapArchive } from "../maps/mapResource/archiveReader";
import type { MeasureCompatibilityInventory } from "../catalogue/measureCompatibility";
import type { NamedLocationInventory } from "../places/namedLocations";
import type { RelationshipCandidateInventory } from "../relationships/relationshipCandidates";
import type { RelationshipPathInventory } from "../relationships/relationshipPaths";
import type { ApiResponse, StoredFile } from "../api/routeResponse";
import type { ValidationReport } from "../catalogue/validationReport";
import type { AnalysisGeographyInventory } from "./analysisGeographies";
import type { AnalysisGeographyValidationInventory } from "./analysisGeographyValidation";
import type { TerrainCatalogue } from "../maps/terrainCatalogue";
import type {
	AsyncTerrainProvider,
	TerrainProvider,
} from "../maps/terrainProvider";
import type { OperationMatcher } from "../api/operationTemplates";

export type { CrosswalkLookup } from "../relationships/translation";

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
