import type { AreaGeometryCache } from "./areaGeometry";
import type { AreaInventory, AreaLookup } from "./areaInventory";
import type { AreaSearchIndex } from "./areaSearch";
import type { AreaRelationshipIndex } from "./areaRelationships";
import type { AtlasRelease } from "./atlasRelease";
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
import type {
	NamedLocationInventory,
	NamedLocationLookup,
} from "./namedLocations";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";
import type { RelationshipPathInventory } from "./relationshipPaths";
import type { ApiResponse } from "./routeResponse";
import type { ValidationReport } from "./validationReport";

export type CrosswalkLookup = Map<string, CrosswalkArtifact>;

/** The independently-built resources available to API route handlers. */
export type RouteContext = {
	boundaryRegistry: BoundaryRegistry;
	geographyInventory?: GeographyInventory;
	/** Each boundary release's identity artifact and its content hash. */
	areaInventory?: AreaInventory;
	areaLookup?: AreaLookup;
	crosswalkInventory?: CrosswalkInventory;
	crosswalkLookup?: CrosswalkLookup;
	atlasRelease?: AtlasRelease;
	atlasReleaseHistory?: Map<string, AtlasRelease>;
	areaSearchIndex?: AreaSearchIndex;
	areaRelationshipIndex?: AreaRelationshipIndex;
	/** Compiled geography indexes and domain operations for this Atlas release. */
	geographyResolver?: GeographyResolver;
	relationshipPathInventory?: RelationshipPathInventory;
	areaGeometryCache?: AreaGeometryCache;
	relationshipCandidateInventory?: RelationshipCandidateInventory;
	validationReport?: ValidationReport;
	namedLocationInventory?: NamedLocationInventory;
	namedLocationLookup?: NamedLocationLookup;
	locationProjectionInventory?: LocationProjectionInventory;
	locationProjectionStore?: LocationProjectionStore;
	dataCatalog?: DataCatalog;
	populationObservations?: PopulationObservationArtifact;
	populationLocalAuthorityObservations?: PopulationLocalAuthorityObservationArtifact;
	/** Every measure's observations bar the two population artifacts. */
	measureObservations?: AnyMeasureObservationArtifact[];
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
	exportManifest?: ExportManifest;
	/** The OpenAPI description the server serves at `/v1/openapi.yaml`. */
	openapiDocument?: string;
	lookupManifest?: LookupManifest;
	/** The boundary releases published as map resources, and their tiles. */
	mapResources?: { resources: MapResourceDescriptor[] };
	/** Each map resource's archive, opened once and keyed by resource id. */
	mapArchives?: Map<string, MapArchive>;
};

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
