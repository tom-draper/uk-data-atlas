import { problem, type ApiResponse } from "./runtime/index.ts";
import type { RouteRequest } from "./runtime/index.ts";
import { validateContractResponse } from "./contract/validateResponse";
import { handleOpenapiRoutes, isOpenapiRoute } from "./openapiRoutes";
import { handleDocumentRoutes } from "./documents/documentRoutes";
import {
	handleAtlasPageRoutes,
	handleAtlasLookupRoutes,
} from "./atlas/atlasAssetRoutes";
import type {
	FullDetailResult,
	FullDetailSource,
} from "@uk-data-atlas/geometry";
import { handleMapResourceRoutes } from "./mapResources/mapResourceRoutes";
import { handleBoundaryRoutes } from "./boundaries/boundaryRoutes";
import { handleCatalogueRoutes } from "./catalogue/catalogueRoutes";
import {
	handleTerrainRoutes,
	handleTerrainRoutesAsync,
} from "./terrain/terrainRoutes";
import { handleCoordinateRoutes } from "./coordinates/coordinateRoutes";
import { handleDataRoutes } from "./data/dataRoutes";
import { handleDataSeriesRoutes } from "./data/dataSeriesRoutes";
import { handleDataRankingRoutes } from "./data/dataRankingRoutes";
import { handleDataChangeRoutes } from "./data/dataChangeRoutes";
import { handleDataValueRoutes } from "./data/dataValueRoutes";
import { handlePlaceRoutes } from "./places/placeRoutes";
import {
	handlePostcodeBatchRoutes,
	handlePostcodeRoutes,
} from "./places/postcodeRoutes";
import { handleDataTransformRoutes } from "./data/dataTransformRoutes";
import { handleDataConversionRoutes } from "./data/dataConversionRoutes";
import { handleAnalysisGeographyRoutes } from "./analysis/analysisGeographyRoutes";
import { handleAreaSearchRoutes } from "./areas/areaSearchRoutes";
import {
	handleAreaContainsBatchRoutes,
	handleAreaContainsRoutes,
} from "./areas/areaContainsRoutes";
import { handleAreaNearRoutes } from "./areas/areaNearRoutes";
import { handleAreaIntersectsRoutes } from "./areas/areaIntersectsRoutes";
import { handleAreaValidationRoutes } from "./areas/areaValidationRoutes";
import { handleAreaIdentityRoutes } from "./areas/areaIdentityRoutes";
import { handleAreaHistoryRoutes } from "./areas/areaHistoryRoutes";
import { handleAreaRelationshipRoutes } from "./areas/areaRelationshipRoutes";
import { handleAreaChildGeometryRoutes } from "./areas/areaChildGeometryRoutes";
import { handleAreaNeighbourRoutes } from "./areas/areaNeighbourRoutes";
import { handleAreaOverlapRoutes } from "./areas/areaOverlapRoutes";
import { handleAreaGeometryRoutes } from "./areas/areaGeometryRoutes";
import { handleSimilarAreaRoutes } from "./areas/similarAreaRoutes";
import { handleTranslationRoutes } from "./crosswalks/translationRoutes";
import { handleRelationshipRoutes } from "./relationships/relationshipRoutes";
import { handleLocationRoutes } from "./places/locationRoutes";
import { handleCrosswalkRoutes } from "./crosswalks/crosswalkRoutes";
import {
	crosswalkConversionId,
	handleCrosswalkConversionRoutes,
} from "./crosswalks/crosswalkConversionRoutes";
import { handleBulkRoutes } from "./bulk/bulkRoutes";
import { handleGovernanceRoutes } from "./runtime/index.ts";
import { handleSyncRoutes } from "./runtime/index.ts";
import { releaseInPath, withReleaseHeaders } from "./releaseDeprecation";
import {
	handleReleaseJoinRoutes,
	handleReleaseJoinRoutesAsync,
	joinRelease,
} from "./boundaries/releaseJoinRoutes";
import {
	canonicalGeographyRequest,
	canonicalMeasureRequest,
	canonicalReleaseRequest,
} from "./canonicalRequests";

export type RouteHandler = (request: RouteRequest) => ApiResponse | undefined;

/**
 * What a route is answered with: the handler for its path, and whether a POST
 * to it carries a body the handler reads. Each Fastify route is bound to one
 * of these, so nothing matches a request to a handler by its segments.
 */
export type RouteBinding = {
	handle: RouteHandler;
	/** Set on the few routes with an operation that reads a POST body. */
	acceptsPost?: true;
	/**
	 * Answers a request that has to wait, such as one that samples a remote
	 * provider. Returns nothing for a request the synchronous handler answers.
	 */
	handleAsync?: (
		request: RouteRequest,
	) => Promise<ApiResponse | undefined> | undefined;
	/**
	 * Names the binding that answers a path when the router cannot tell this
	 * route from a neighbour, such as a release and its `:join`. Returns
	 * nothing when this binding is the one.
	 */
	select?: (segments: string[]) => RouteBinding | undefined;
};

const boundaries: RouteBinding = {
	handle: handleBoundaryRoutes,
	select: (segments) => (joinRelease(segments) ? releaseJoin : undefined),
};

const releaseJoin: RouteBinding = {
	handle: handleReleaseJoinRoutes,
	acceptsPost: true,
	handleAsync: async (request) => {
		const geography = canonicalGeographyRequest(request);
		const release = canonicalReleaseRequest(geography ?? request);
		if (release && "status" in release) return release;
		const routed = release ?? geography ?? request;
		const joined = await handleReleaseJoinRoutesAsync(routed);
		return joined && withPathReleaseHeaders(routed, joined);
	},
	select: (segments) => (joinRelease(segments) ? undefined : boundaries),
};

const crosswalks: RouteBinding = {
	handle: handleCrosswalkRoutes,
	select: (segments) =>
		crosswalkConversionId(segments) === undefined
			? undefined
			: crosswalkConversion,
};

const crosswalkConversion: RouteBinding = {
	handle: handleCrosswalkConversionRoutes,
	acceptsPost: true,
	select: (segments) =>
		crosswalkConversionId(segments) === undefined ? crosswalks : undefined,
};

const mapResources: RouteBinding = {
	handle: handleMapResourceRoutes,
	handleAsync: (request) =>
		request.segments[4] === "features"
			? handleFeatureDownloadAsync(request)
			: undefined,
};

export const bindings = {
	openapi: { handle: handleOpenapiRoutes },
	documents: { handle: handleDocumentRoutes },
	mapResources,
	boundaries,
	releaseJoin,
	catalogue: { handle: handleCatalogueRoutes },
	terrain: {
		handle: handleTerrainRoutes,
		handleAsync: (request) =>
			request.segments[2] === "elevation" &&
			request.segments[3] === "point"
				? handleTerrainRoutesAsync(request)
				: undefined,
	},
	coordinates: { handle: handleCoordinateRoutes },
	analysisGeographies: { handle: handleAnalysisGeographyRoutes },
	data: { handle: handleDataRoutes },
	dataSeries: { handle: handleDataSeriesRoutes },
	dataRankings: { handle: handleDataRankingRoutes },
	dataChange: { handle: handleDataChangeRoutes },
	dataValue: { handle: handleDataValueRoutes },
	places: { handle: handlePlaceRoutes },
	postcodes: { handle: handlePostcodeRoutes },
	postcodesBatch: { handle: handlePostcodeBatchRoutes, acceptsPost: true },
	dataTransforms: { handle: handleDataTransformRoutes },
	dataConversion: { handle: handleDataConversionRoutes },
	areaSearch: { handle: handleAreaSearchRoutes },
	areaContains: { handle: handleAreaContainsRoutes },
	areaContainsBatch: {
		handle: handleAreaContainsBatchRoutes,
		acceptsPost: true,
	},
	areaNear: { handle: handleAreaNearRoutes },
	areaIntersects: { handle: handleAreaIntersectsRoutes },
	areaValidation: { handle: handleAreaValidationRoutes, acceptsPost: true },
	similarAreas: { handle: handleSimilarAreaRoutes },
	areaIdentity: { handle: handleAreaIdentityRoutes },
	areaHistory: { handle: handleAreaHistoryRoutes },
	areaRelationships: { handle: handleAreaRelationshipRoutes },
	areaChildGeometry: { handle: handleAreaChildGeometryRoutes },
	areaNeighbours: { handle: handleAreaNeighbourRoutes },
	areaOverlap: { handle: handleAreaOverlapRoutes },
	areaGeometry: { handle: handleAreaGeometryRoutes },
	translations: { handle: handleTranslationRoutes },
	relationships: { handle: handleRelationshipRoutes },
	governance: { handle: handleGovernanceRoutes },
	locations: { handle: handleLocationRoutes },
	crosswalkConversion,
	crosswalks,
	bulk: { handle: handleBulkRoutes },
	atlasPages: { handle: handleAtlasPageRoutes },
	atlasLookups: { handle: handleAtlasLookupRoutes },
	sync: { handle: handleSyncRoutes },
} satisfies Record<string, RouteBinding>;

export const getOnlyMethodNotAllowed = () =>
	problem(
		405,
		"Method Not Allowed",
		"This resource answers GET only. POST is accepted by the batch lookup routes, /v1/areas:validate, a boundary release's :join and a crosswalk's :convert, where a request carries more than a URL can.",
	);

/** The response with the headers of the deprecated release its path names. */
const withPathReleaseHeaders = (
	request: RouteRequest,
	response: ApiResponse,
): ApiResponse => {
	const named = releaseInPath(request.segments);
	return named
		? withReleaseHeaders(
				response,
				request.context.geographyResolver.boundaryRelease(
					named.geography,
					named.release,
				),
			)
		: response;
};

export const handleRoute = (
	request: RouteRequest,
	declared?: RouteBinding,
): ApiResponse | undefined => {
	const geography = canonicalGeographyRequest(request);
	const release = canonicalReleaseRequest(geography ?? request);
	if (release && "status" in release) return release;
	const measure = canonicalMeasureRequest(release ?? geography ?? request);
	const canonical = measure ?? release ?? geography;
	const routed = canonical ?? request;
	const binding = declared?.select?.(routed.segments) ?? declared;
	if (binding && routed.method === "POST" && !binding.acceptsPost)
		return getOnlyMethodNotAllowed();
	const handled = binding?.handle(routed);
	if (!handled) return handled;
	const response = withPathReleaseHeaders(
		routed,
		validateContractResponse(routed.segments, handled),
	);
	if (!canonical) return response;
	const { pathname, search } = canonical.parsedUrl;
	return {
		...response,
		headers: { ...response.headers, "content-location": pathname + search },
	};
};

export const handleRouteAsync = async (
	request: RouteRequest,
	declared?: RouteBinding,
): Promise<ApiResponse | undefined> => {
	const binding = declared?.select?.(request.segments) ?? declared;
	const waiting = binding?.handleAsync?.(request);
	return waiting ? waiting : handleRoute(request, binding);
};

/**
 * A map download, awaiting a full-tier file that has to be built. The route
 * is run once to find which file it would send; if that file must be built,
 * the build is awaited and the route run again with it. Parsing and every
 * answer stay in the one synchronous route.
 */
const handleFeatureDownloadAsync = async (
	request: RouteRequest,
): Promise<ApiResponse | undefined> => {
	const downloads = request.context.fullDetailDownloads;
	if (!downloads?.build) return handleRoute(request, mapResources);
	const using = (source: FullDetailSource): RouteRequest => ({
		...request,
		context: { ...request.context, fullDetailDownloads: source },
	});
	let pending: Promise<FullDetailResult> | undefined;
	const first = handleRoute(
		using({
			get: (...asked) => {
				pending = downloads.build!(...asked);
				return { status: "unavailable" };
			},
		}),
		mapResources,
	);
	if (!pending) return first;
	const result = await pending;
	return handleRoute(using({ get: () => result }), mapResources);
};
