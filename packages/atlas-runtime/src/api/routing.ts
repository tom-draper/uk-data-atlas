import type { AreaInventory } from "@uk-data-atlas/areas";
import type { AtlasRelease } from "../storage/atlasRelease";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import type { CrosswalkArtifact } from "@uk-data-atlas/relationships";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
} from "@uk-data-atlas/measures";
import type { ExportManifest } from "../storage/exportManifest";
import type { GeographyInventory } from "../areas/geographyInventory";
import type { LookupManifest } from "../areas/lookupExports";
import type { FullDetailSource } from "../areas/fullDetailDownloads";
import type { GeographyResolver } from "../areas/geographyResolver";
import type { AreaGeometryCache } from "../geometry/areaGeometry";
import type {
	LocationProjectionInventory,
	LocationProjections,
} from "../places/locationProjections";
import type { MapResources } from "@uk-data-atlas/map-tiles/mapResources";
import type { MapArchive } from "../maps/mapResource/archiveReader";
import type { MeasureCompatibilityInventory } from "@uk-data-atlas/measures";
import type { NamedLocationInventory } from "../places/namedLocations";
import type { RelationshipCandidateInventory } from "../relationships/relationshipCandidates";
import type { RelationshipPathInventory } from "@uk-data-atlas/relationships";
import type { ApiResponse } from "./routeResponse";
import type { StoredFile } from "@uk-data-atlas/artifacts";
import type { ValidationReport } from "../catalogue/validationReport";
import type { AnalysisGeographyInventory } from "../areas/analysisGeographies";
import type { AnalysisGeographyValidationInventory } from "../areas/analysisGeographyValidation";
import type { TerrainCatalogue } from "@uk-data-atlas/terrain";
import type {
	AsyncTerrainProvider,
	TerrainProvider,
} from "@uk-data-atlas/terrain";
import type { OperationMatcher } from "./operationTemplates";

/** The independently-built resources available to API route handlers. */
export type RouteContext = {
	boundaryRegistry: BoundaryRegistry;
	geographyInventory?: GeographyInventory;
	/** Each boundary release's identity artifact and its content hash. */
	areaInventory?: AreaInventory;
	crosswalkInventory?: CrosswalkInventory;
	atlasRelease?: AtlasRelease;
	/** Compiled geography indexes and domain operations for this Atlas release. */
	geographyResolver: Pick<GeographyResolver, keyof GeographyResolver>;
	areaGeometryCache?: AreaGeometryCache;
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

export type RouteDispatchContext = Omit<RouteContext, "geographyResolver"> & {
	geographyResolver: Omit<
		RouteContext["geographyResolver"],
		"geographyHealth"
	>;
};

export type RouteRequest = {
	context: RouteDispatchContext;
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

/** A route's geography operations, limited to those it uses. */
export type RouteContextFor<K extends keyof GeographyResolver> = Omit<
	RouteContext,
	"geographyResolver"
> & ([K] extends [never] ? object : { geographyResolver: Pick<GeographyResolver, K> });
export type RouteRequestFor<K extends keyof GeographyResolver> = Omit<
	RouteRequest,
	"context"
> & { context: RouteContextFor<K> };
