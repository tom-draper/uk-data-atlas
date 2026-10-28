import { problem, type ApiResponse } from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequest } from "@uk-data-atlas/atlas-runtime/areas";
import { handleIndexRoutes } from "./indexRoutes";
import { handleOpenapiRoutes, isOpenapiRoute } from "./openapiRoutes";
import { handleDocumentRoutes } from "./documentRoutes";
import { handleAtlasPageRoutes } from "@uk-data-atlas/atlas-runtime/storage";
import { handleAtlasLookupRoutes } from "@uk-data-atlas/atlas-runtime/storage";
import type {
	FullDetailResult,
	FullDetailSource,
} from "@uk-data-atlas/atlas-runtime/areas";
import { handleMapResourceRoutes } from "./mapResourceRoutes";
import { handleBoundaryRoutes } from "./boundaryRoutes";
import { handleCatalogueRoutes } from "./catalogueRoutes";
import { handleTerrainRoutes, handleTerrainRoutesAsync } from "./terrainRoutes";
import { handleCoordinateRoutes } from "./coordinateRoutes";
import { handleDataRoutes } from "./dataRoutes";
import { handleDataSeriesRoutes } from "./dataSeriesRoutes";
import { handleDataRankingRoutes } from "./dataRankingRoutes";
import { handleDataChangeRoutes } from "./dataChangeRoutes";
import { handleDataValueRoutes } from "./dataValueRoutes";
import { handlePlaceRoutes } from "./placeRoutes";
import {
	handlePostcodeBatchRoutes,
	handlePostcodeRoutes,
} from "./postcodeRoutes";
import { handleDataTransformRoutes } from "./dataTransformRoutes";
import { handleDataConversionRoutes } from "./dataConversionRoutes";
import { handleAnalysisGeographyRoutes } from "@uk-data-atlas/atlas-runtime/api";
import { handleAreaSearchRoutes } from "./areaSearchRoutes";
import {
	handleAreaContainsBatchRoutes,
	handleAreaContainsRoutes,
} from "./areaContainsRoutes";
import { handleAreaNearRoutes } from "./areaNearRoutes";
import { handleAreaIntersectsRoutes } from "./areaIntersectsRoutes";
import { handleAreaValidationRoutes } from "./areaValidationRoutes";
import { handleAreaIdentityRoutes } from "./areaIdentityRoutes";
import { handleAreaHistoryRoutes } from "./areaHistoryRoutes";
import { handleAreaRelationshipRoutes } from "./areaRelationshipRoutes";
import { handleAreaChildGeometryRoutes } from "./areaChildGeometryRoutes";
import { handleAreaNeighbourRoutes } from "./areaNeighbourRoutes";
import { handleAreaOverlapRoutes } from "./areaOverlapRoutes";
import { handleAreaGeometryRoutes } from "./areaGeometryRoutes";
import { handleTranslationRoutes } from "./translationRoutes";
import { handleRelationshipRoutes } from "./relationshipRoutes";
import { handleLocationRoutes } from "./locationRoutes";
import { handleCrosswalkRoutes } from "./crosswalkRoutes";
import {
	crosswalkConversionId,
	handleCrosswalkConversionRoutes,
} from "./crosswalkConversionRoutes";
import { handleBulkRoutes } from "./bulkRoutes";
import { handleGovernanceRoutes } from "@uk-data-atlas/atlas-runtime/api";
import { handleSyncRoutes } from "@uk-data-atlas/atlas-runtime/api";
import { releaseInPath, withReleaseHeaders } from "./releaseDeprecation";
import {
	handleReleaseJoinRoutes,
	handleReleaseJoinRoutesAsync,
	joinRelease,
} from "./releaseJoinRoutes";
import {
	canonicalGeographyRequest,
	canonicalMeasureRequest,
	canonicalReleaseRequest,
} from "./canonicalRequests";

export type RouteHandler = (request: RouteRequest) => ApiResponse | undefined;

type RouteFamily = {
	name: string;
	owns: (segments: string[]) => boolean;
	handle: RouteHandler;
	/** Set on the few families with an operation that reads a POST body. */
	acceptsPost?: true;
};

type Shape = {
	/** The exact number of segments the path has. */
	length?: number;
	/** The most segments the path may have. */
	maxLength?: number;
	/** The segments that must sit at given positions, by index. */
	at?: Record<number, string | readonly string[]>;
};

/**
 * Matches a path under `/v1/{resource}`, narrowed by how long it is and by
 * what sits at later positions. A list of resources matches any of them.
 */
const v1 = (
	resource: string | readonly string[],
	{ length, maxLength, at = {} }: Shape = {},
) => {
	const resources = typeof resource === "string" ? [resource] : resource;
	const positions = Object.entries(at).map(([index, expected]) => ({
		index: Number(index),
		expected: typeof expected === "string" ? [expected] : expected,
	}));
	return (segments: string[]) =>
		segments[0] === "v1" &&
		resources.includes(segments[1] ?? "") &&
		(length === undefined || segments.length === length) &&
		(maxLength === undefined || segments.length <= maxLength) &&
		positions.every(({ index, expected }) =>
			expected.includes(segments[index] ?? ""),
		);
};

const documentPath = v1("documents", { length: 3 });
const datasetPath = v1("datasets");
const measureBasePath = v1("measures", { maxLength: 3 });
const analysisPath = v1(["analysis-geographies", "analysis:plan"]);
const boundaryPath = v1([
	"geographies",
	"boundary-releases",
	"boundary-releases:resolve",
	"boundary-releases:compare",
]);

/**
 * Each family declares the resources it owns before it handles a request.
 * No path may be owned by two families, which keeps dispatch independent of
 * the order below and makes a new route's home explicit.
 */
const routeFamilies: RouteFamily[] = [
	{
		name: "index",
		owns: (segments) => segments.length === 1 && segments[0] === "v1",
		handle: handleIndexRoutes,
	},
	{
		name: "openapi",
		owns: isOpenapiRoute,
		handle: handleOpenapiRoutes,
	},
	{
		name: "documents",
		owns: (segments) =>
			documentPath(segments) && segments[2]?.endsWith(".json") === true,
		handle: handleDocumentRoutes,
	},
	{
		name: "map-resources",
		owns: v1("map-resources"),
		handle: handleMapResourceRoutes,
	},
	{
		name: "boundaries",
		owns: (segments) => boundaryPath(segments) && !joinRelease(segments),
		handle: handleBoundaryRoutes,
	},
	{
		name: "release-join",
		owns: (segments) => joinRelease(segments) !== undefined,
		handle: handleReleaseJoinRoutes,
		acceptsPost: true,
	},
	{
		name: "catalogue",
		owns: (segments) => datasetPath(segments) || measureBasePath(segments),
		handle: handleCatalogueRoutes,
	},
	{
		name: "terrain",
		owns: v1("terrain"),
		handle: handleTerrainRoutes,
	},
	{
		name: "coordinates",
		owns: v1("coordinates:convert", { length: 2 }),
		handle: handleCoordinateRoutes,
	},
	{
		name: "analysis-geographies",
		owns: (segments) => analysisPath(segments),
		handle: handleAnalysisGeographyRoutes,
	},
	{
		name: "data",
		owns: v1("data", { length: 3 }),
		handle: handleDataRoutes,
	},
	{
		name: "data-series",
		owns: v1("data", { length: 4, at: { 3: "series" } }),
		handle: handleDataSeriesRoutes,
	},
	{
		name: "data-rankings",
		owns: v1("data", { length: 4, at: { 3: "rankings" } }),
		handle: handleDataRankingRoutes,
	},
	{
		name: "data-change",
		owns: v1("data", { length: 4, at: { 3: "change" } }),
		handle: handleDataChangeRoutes,
	},
	{
		name: "data-value",
		owns: v1("data", { length: 4, at: { 3: "value" } }),
		handle: handleDataValueRoutes,
	},
	{
		name: "places",
		owns: v1("places"),
		handle: handlePlaceRoutes,
	},
	{
		name: "postcodes",
		owns: v1("postcodes"),
		handle: handlePostcodeRoutes,
	},
	{
		name: "postcodes-batch",
		owns: v1("postcodes:batch", { length: 2 }),
		handle: handlePostcodeBatchRoutes,
		acceptsPost: true,
	},
	{
		name: "data-transforms",
		owns: v1("data", { length: 4, at: { 3: "compare" } }),
		handle: handleDataTransformRoutes,
	},
	{
		name: "data-conversion",
		owns: v1("data", { length: 4, at: { 3: "convert" } }),
		handle: handleDataConversionRoutes,
	},
	{
		name: "area-search",
		owns: v1("areas", { length: 2 }),
		handle: handleAreaSearchRoutes,
	},
	{
		name: "area-contains",
		owns: v1("areas:contains"),
		handle: handleAreaContainsRoutes,
	},
	{
		name: "area-contains-batch",
		owns: v1("areas:containsBatch"),
		handle: handleAreaContainsBatchRoutes,
		acceptsPost: true,
	},
	{
		name: "area-near",
		owns: v1("areas:near"),
		handle: handleAreaNearRoutes,
	},
	{
		name: "area-intersects",
		owns: v1("areas:intersects", { length: 2 }),
		handle: handleAreaIntersectsRoutes,
	},
	{
		name: "area-validation",
		owns: v1("areas:validate"),
		handle: handleAreaValidationRoutes,
		acceptsPost: true,
	},
	{
		name: "area-identity",
		owns: v1("areas", { length: 5 }),
		handle: handleAreaIdentityRoutes,
	},
	{
		name: "area-history",
		owns: v1("areas", { length: 6, at: { 5: "history" } }),
		handle: handleAreaHistoryRoutes,
	},
	{
		name: "area-relationships",
		owns: v1("areas", {
			length: 6,
			at: { 5: ["parents", "children", "relationships"] },
		}),
		handle: handleAreaRelationshipRoutes,
	},
	{
		name: "area-child-geometry",
		owns: v1("areas", {
			length: 7,
			at: { 5: "children", 6: "geometry" },
		}),
		handle: handleAreaChildGeometryRoutes,
	},
	{
		name: "area-neighbours",
		owns: v1("areas", { length: 6, at: { 5: "neighbours" } }),
		handle: handleAreaNeighbourRoutes,
	},
	{
		name: "area-overlap",
		owns: v1("areas", { length: 6, at: { 5: "overlap" } }),
		handle: handleAreaOverlapRoutes,
	},
	{
		name: "area-geometry",
		owns: v1("areas", { length: 6, at: { 5: "geometry" } }),
		handle: handleAreaGeometryRoutes,
	},
	{
		name: "translations",
		owns: v1("translations", { length: 2 }),
		handle: handleTranslationRoutes,
	},
	{
		name: "relationships",
		owns: v1("relationships", { length: 2 }),
		handle: handleRelationshipRoutes,
	},
	{
		name: "governance",
		owns: v1("attribution"),
		handle: handleGovernanceRoutes,
	},
	{
		name: "locations",
		owns: v1("locations"),
		handle: handleLocationRoutes,
	},
	{
		name: "crosswalk-conversion",
		owns: (segments) => crosswalkConversionId(segments) !== undefined,
		handle: handleCrosswalkConversionRoutes,
		acceptsPost: true,
	},
	{
		name: "crosswalks",
		owns: (segments) =>
			v1("crosswalks")(segments) &&
			crosswalkConversionId(segments) === undefined,
		handle: handleCrosswalkRoutes,
	},
	{
		name: "bulk",
		owns: v1(["exports", "lookups"]),
		handle: handleBulkRoutes,
	},
	{
		name: "atlas-pages",
		owns: v1("atlas-pages", { length: 3 }),
		handle: handleAtlasPageRoutes,
	},
	{
		name: "atlas-lookups",
		owns: v1("atlas-lookups", { length: 3 }),
		handle: handleAtlasLookupRoutes,
	},
	{
		name: "sync",
		owns: v1("atlas-release"),
		handle: handleSyncRoutes,
	},
];

/** The names of the families that claim a path; routing expects exactly one. */
export const routeFamiliesOwning = (segments: string[]) =>
	routeFamilies.filter(({ owns }) => owns(segments)).map(({ name }) => name);

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

export const handleRoute = (request: RouteRequest): ApiResponse | undefined => {
	const geography = canonicalGeographyRequest(request);
	const release = canonicalReleaseRequest(geography ?? request);
	if (release && "status" in release) return release;
	const measure = canonicalMeasureRequest(release ?? geography ?? request);
	const canonical = measure ?? release ?? geography;
	const routed = canonical ?? request;
	const family = routeFamilies.find(({ owns }) => owns(routed.segments));
	if (family && routed.method === "POST" && !family.acceptsPost)
		return problem(
			405,
			"Method Not Allowed",
			"This resource answers GET only. POST is accepted by the batch lookup routes, /v1/areas:validate, a boundary release's :join and a crosswalk's :convert, where a request carries more than a URL can.",
		);
	const handled = family?.handle(routed);
	if (!handled) return handled;
	const response = withPathReleaseHeaders(routed, handled);
	if (!canonical) return response;
	const { pathname, search } = canonical.parsedUrl;
	return {
		...response,
		headers: { ...response.headers, "content-location": pathname + search },
	};
};

export const handleRouteAsync = async (
	request: RouteRequest,
): Promise<ApiResponse | undefined> => {
	if (joinRelease(request.segments)) {
		const geography = canonicalGeographyRequest(request);
		const release = canonicalReleaseRequest(geography ?? request);
		if (release && "status" in release) return release;
		const routed = release ?? geography ?? request;
		const joined = await handleReleaseJoinRoutesAsync(routed);
		return joined && withPathReleaseHeaders(routed, joined);
	}
	if (
		request.segments[0] === "v1" &&
		request.segments[1] === "terrain" &&
		request.segments[2] === "elevation" &&
		request.segments[3] === "point"
	) {
		return handleTerrainRoutesAsync(request);
	}
	if (
		request.segments[1] === "map-resources" &&
		request.segments[4] === "features"
	)
		return handleFeatureDownloadAsync(request);
	return handleRoute(request);
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
	if (!downloads?.build) return handleRoute(request);
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
	);
	if (!pending) return first;
	const result = await pending;
	return handleRoute(using({ get: () => result }));
};
