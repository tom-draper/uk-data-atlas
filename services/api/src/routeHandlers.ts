import { problem, type ApiResponse } from "./routeResponse";
import { releaseMonth } from "./releaseForDate";
import type { RouteRequest } from "./routing";
import { handleIndexRoutes } from "./indexRoutes";
import { handleOpenapiRoutes, isOpenapiRoute } from "./openapiRoutes";
import { handleDocumentRoutes } from "./documentRoutes";
import { handleMapResourceRoutes } from "./mapResourceRoutes";
import { handleBoundaryRoutes } from "./boundaryRoutes";
import { handleCatalogueRoutes } from "./catalogueRoutes";
import { handleTerrainRoutes, handleTerrainRoutesAsync } from "./terrainRoutes";
import { handleCoordinateRoutes } from "./coordinateRoutes";
import { handleMeasureCompatibilityRoutes } from "./measureCompatibilityRoutes";
import { handleCoveragePlanRoutes } from "./coveragePlanRoutes";
import { handleMeasureReconciliationRoutes } from "./measureReconciliationRoutes";
import { handleMeasureCoverageRoutes } from "./measureCoverageRoutes";
import { handleMeasureQualityRoutes } from "./measureQualityRoutes";
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
import { handleDataAggregateRoutes } from "./dataAggregateRoutes";
import { handleDataConversionRoutes } from "./dataConversionRoutes";
import { handleAnalysisGeographyRoutes } from "./analysisGeographyRoutes";
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
import { handleRelationshipRepairRoutes } from "./relationshipRepairRoutes";
import { handleGeographyHealthRoutes } from "./geographyHealthRoutes";
import { handleLocationRoutes } from "./locationRoutes";
import { handleCrosswalkRoutes } from "./crosswalkRoutes";
import { handleBulkRoutes } from "./bulkRoutes";
import { handleGovernanceRoutes } from "./governanceRoutes";
import { handleSyncRoutes } from "./syncRoutes";
import { canonicalMeasureId } from "./measureTerms";
import { handleReleaseJoinRoutes, joinRelease } from "./releaseJoinRoutes";
import { canonicalGeography } from "./geography";

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
const conversionSupportPath = v1("measures", {
	at: { 3: "conversion-support" },
});
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
		name: "measure-compatibility",
		owns: v1("measures", { at: { 3: "compatibility" } }),
		handle: handleMeasureCompatibilityRoutes,
	},
	{
		name: "measure-reconciliation",
		owns: v1("measures", { at: { 3: "reconciliation" } }),
		handle: handleMeasureReconciliationRoutes,
	},
	{
		name: "measure-coverage-plan",
		owns: v1("measures", { at: { 3: "coverage-plan" } }),
		handle: handleCoveragePlanRoutes,
	},
	{
		name: "measure-coverage",
		owns: v1("measures", { at: { 3: "coverage" } }),
		handle: handleMeasureCoverageRoutes,
	},
	{
		name: "measure-quality",
		owns: v1("measures", { at: { 3: "quality" } }),
		handle: handleMeasureQualityRoutes,
	},
	{
		name: "analysis-geographies",
		owns: (segments) =>
			analysisPath(segments) || conversionSupportPath(segments),
		handle: handleAnalysisGeographyRoutes,
	},
	{
		name: "geography-health",
		owns: v1("geography-health", { length: 2 }),
		handle: handleGeographyHealthRoutes,
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
		name: "data-aggregate",
		owns: v1("data", { length: 4, at: { 3: "aggregate" } }),
		handle: handleDataAggregateRoutes,
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
		name: "relationship-repairs",
		owns: v1("relationship-repairs", { length: 2 }),
		handle: handleRelationshipRepairRoutes,
	},
	{
		name: "governance",
		owns: v1(["attribution", "corrections", "relationship-candidates"]),
		handle: handleGovernanceRoutes,
	},
	{
		name: "locations",
		owns: v1("locations"),
		handle: handleLocationRoutes,
	},
	{
		name: "crosswalks",
		owns: v1("crosswalks"),
		handle: handleCrosswalkRoutes,
	},
	{
		name: "bulk",
		owns: v1(["exports", "lookups"]),
		handle: handleBulkRoutes,
	},
	{
		name: "sync",
		owns: v1(["atlas-release", "validation"]),
		handle: handleSyncRoutes,
	},
];

/** The names of the families that claim a path; routing expects exactly one. */
export const routeFamiliesOwning = (segments: string[]) =>
	routeFamilies.filter(({ owns }) => owns(segments)).map(({ name }) => name);

// Where a path carries a measure id: /v1/data/{id}, /v1/measures/{id} and a
// map resource's /join/{id}.
const measureSegment = (segments: string[]) =>
	segments[0] !== "v1"
		? undefined
		: segments[1] === "data" || segments[1] === "measures"
			? 2
			: segments[1] === "map-resources" && segments[4] === "join"
				? 5
				: undefined;

/**
 * The request with every measure alias replaced by the id it names, or
 * undefined when it names none. A route then only ever sees ids, and the
 * response says what the alias was read as.
 */
const canonicalMeasureRequest = (
	request: RouteRequest,
): RouteRequest | undefined => {
	const catalog = request.context.dataCatalog;
	if (!catalog) return undefined;
	const canonical = (term: string) =>
		canonicalMeasureId(catalog, term) ?? term;
	const segments = [...request.segments];
	const position = measureSegment(segments);
	if (position !== undefined && segments[position] !== undefined)
		segments[position] = canonical(segments[position]!);
	const url = new URL(request.parsedUrl);
	const measures = url.searchParams.getAll("measure");
	if (measures.length > 0) {
		url.searchParams.delete("measure");
		for (const measure of measures)
			url.searchParams.append("measure", canonical(measure));
	}
	url.pathname = `/${segments.map(encodeURIComponent).join("/")}`;
	const changed =
		segments.some(
			(segment, index) => segment !== request.segments[index],
		) || measures.some((measure) => canonical(measure) !== measure);
	return changed ? { ...request, parsedUrl: url, segments } : undefined;
};

/** The word that stands for a geography's newest release in a path. */
export const LATEST_RELEASE = "latest";

/** Replace a path geography abbreviation before any route resolves releases. */
const canonicalGeographyRequest = (
	request: RouteRequest,
): RouteRequest | undefined => {
	const { segments } = request;
	if (
		segments[0] !== "v1" ||
		!["areas", "boundary-releases", "map-resources"].includes(
			segments[1] ?? "",
		)
	)
		return undefined;
	const geography = segments[2];
	const canonical = geography && canonicalGeography(geography);
	if (!canonical || canonical === geography) return undefined;
	const canonicalSegments = [...segments];
	canonicalSegments[2] = canonical;
	const parsedUrl = new URL(request.parsedUrl);
	parsedUrl.pathname = `/${canonicalSegments
		.map((segment) => encodeURIComponent(segment).replaceAll("%3A", ":"))
		.join("/")}`;
	return { ...request, parsedUrl, segments: canonicalSegments };
};

/**
 * Where a path names a boundary release as `latest`, and what the segment
 * carries after it: `:join` on a release, `.pmtiles` on a map resource.
 */
const latestReleaseSegment = (segments: string[]) => {
	if (
		segments[0] !== "v1" ||
		!["areas", "boundary-releases", "map-resources"].includes(
			segments[1] ?? "",
		) ||
		segments[2] === undefined
	)
		return undefined;
	const suffix = new RegExp(`^${LATEST_RELEASE}(:join|\\.pmtiles)?$`).exec(
		segments[3] ?? "",
	);
	return suffix
		? { geography: segments[2], suffix: suffix[1] ?? "" }
		: undefined;
};

/**
 * The request with `latest` replaced by the geography's newest release, the
 * one `/boundary-releases:resolve` would choose for the furthest date, or
 * the problem that says why there is no one newest release. A route only
 * ever sees a release id, and the response names the release it read.
 */
const canonicalReleaseRequest = (
	request: RouteRequest,
): RouteRequest | ApiResponse | undefined => {
	const latest = latestReleaseSegment(request.segments);
	if (!latest) return undefined;
	const releases = request.context.boundaryRegistry.releases.filter(
		(release) => release.geography === latest.geography,
	);
	const selection =
		releases.length === 1
			? undefined
			: request.context.geographyResolver.selectReleaseForDate(
					latest.geography,
					"9999-12",
				);
	if (releases.length === 0)
		return problem(
			404,
			"Not Found",
			`No boundary release is published for the geography ${latest.geography}.`,
			{
				code: "unsupported_geography",
				links: { geographies: "/v1/geographies" },
			},
		);
	// A release id without a month cannot be placed in time, so while one
	// stands beside others which of them is newest is not something to guess.
	const undated = releases.filter(
		(release) => releaseMonth(release.id) === undefined,
	);
	if (
		releases.length > 1 &&
		(undated.length > 0 || selection?.status !== "selected")
	)
		return problem(
			409,
			"Ambiguous Release",
			undated.length > 0
				? `${undated.map((release) => release.id).join(" and ")} ${undated.length === 1 ? "carries" : "carry"} no month, so which ${latest.geography} release is newest cannot be told. Name one by id; each is listed in choices.`
				: `Several ${latest.geography} boundary releases share the latest month and differ in more than coverage. Name one by id; each is listed in choices.`,
			{
				code: "ambiguous_release",
				// The newest dated release, or those tied for it, and every
				// undated one, since any of them may be the newest.
				choices: [
					...(selection?.status === "selected"
						? [selection.selected]
						: selection?.status === "ambiguous"
							? selection.choices
							: []),
					...undated.map((release) => ({
						id: release.id,
						title: release.title,
						countries: release.coverage.countries,
						href: `/v1/boundary-releases/${latest.geography}/${release.id}`,
					})),
				],
			},
		);
	const newest =
		selection?.status === "selected"
			? selection.selected.id
			: releases[0]!.id;
	const segments = [...request.segments];
	segments[3] = `${newest}${latest.suffix}`;
	const url = new URL(request.parsedUrl);
	// A colon is legal in a path segment, and `:join` reads better as one.
	url.pathname = `/${segments
		.map((segment) => encodeURIComponent(segment).replaceAll("%3A", ":"))
		.join("/")}`;
	return { ...request, parsedUrl: url, segments };
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
			"This resource answers GET only. POST is accepted by the batch lookup routes, /v1/areas:validate and a boundary release's :join, where a request carries more than a URL can.",
		);
	const response = family?.handle(routed);
	if (!canonical || !response) return response;
	const { pathname, search } = canonical.parsedUrl;
	return {
		...response,
		headers: { ...response.headers, "content-location": pathname + search },
	};
};

export const handleRouteAsync = async (
	request: RouteRequest,
): Promise<ApiResponse | undefined> => {
	if (
		request.segments[0] === "v1" &&
		request.segments[1] === "terrain" &&
		request.segments[2] === "elevation" &&
		request.segments[3] === "point"
	) {
		return handleTerrainRoutesAsync(request);
	}
	return handleRoute(request);
};
