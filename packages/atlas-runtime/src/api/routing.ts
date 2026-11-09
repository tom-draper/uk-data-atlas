import type { AreaInventory } from "@uk-data-atlas/areas";
import type { AtlasRelease } from "@uk-data-atlas/atlas-db";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import type { CrosswalkArtifact } from "@uk-data-atlas/relationships";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
} from "@uk-data-atlas/measures";
import type { ExportManifest } from "@uk-data-atlas/catalogue/node";
import type { GeographyInventory } from "../loader/geographyInventory.ts";
import type { LookupManifest } from "@uk-data-atlas/areas";
import type { FullDetailSource } from "../loader/fullDetailDownloads.ts";
import type { GeographyResolver } from "../loader/geographyResolver.ts";
import type { PostcodeResolver } from "../loader/resolver/postcodes.ts";
import type { AreaValidation } from "../loader/resolver/areaValidation.ts";
import type { AreaGeometryCache } from "@uk-data-atlas/geometry";
import type {
	LocationProjectionInventory,
	LocationProjections,
} from "@uk-data-atlas/places";
import type { MapResources } from "@uk-data-atlas/map-tiles/mapResources";
import type { MapArchive } from "@uk-data-atlas/map-tiles/node";
import type { MeasureCompatibilityInventory } from "@uk-data-atlas/measures";
import type { MeasureDimensions } from "@uk-data-atlas/measures";
import type { NamedLocationInventory } from "@uk-data-atlas/places";
import type { RelationshipCandidateInventory } from "@uk-data-atlas/relationships";
import type { RelationshipPathInventory } from "@uk-data-atlas/relationships";
import type { ApiResponse } from "./routeResponse.ts";
import type { StoredFile } from "@uk-data-atlas/artifacts";
import type { ValidationReport } from "@uk-data-atlas/catalogue/node";
import type { AnalysisGeographyInventory } from "@uk-data-atlas/relationships";
import type { AnalysisGeographyValidationInventory } from "@uk-data-atlas/catalogue/node";
import type { TerrainCatalogue } from "@uk-data-atlas/terrain";
import type {
	AsyncTerrainProvider,
	TerrainProvider,
} from "@uk-data-atlas/terrain";
import type { OperationMatcher } from "./operationTemplates.ts";

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
	areaValidation: Pick<AreaValidation, "validateAreas" | "matchAreaValues">;
	postcodes: Pick<
		PostcodeResolver,
		"postcodeCounts" | "postcodeIndex" | "postcodeContainingAreas"
	>;
	relationshipPathInventory?: RelationshipPathInventory;
	relationshipCandidateInventory?: RelationshipCandidateInventory;
	validationReport?: ValidationReport;
	namedLocationInventory?: NamedLocationInventory;
	locationProjectionInventory?: LocationProjectionInventory;
	locationProjectionStore?: LocationProjections;
	dataCatalog?: DataCatalog;
	/**
	 * How each catalogue measure id maps onto a measure and its dimension
	 * members. Absent, a request names catalogue ids only and dimension
	 * filters are not accepted.
	 */
	measureDimensions?: MeasureDimensions;
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
	context: RouteDispatchContext &
		Required<Pick<RouteContext, "areaValidation">>;
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
	"geographyResolver" | "areaValidation" | "postcodes"
> &
	Partial<Pick<RouteContext, "areaValidation" | "postcodes">> &
	([K] extends [never]
		? object
		: { geographyResolver: Pick<GeographyResolver, K> });
export type RouteRequestFor<K extends keyof GeographyResolver> = Omit<
	RouteRequest,
	"context"
> & { context: RouteContextFor<K> };
