import { problem, type ApiResponse } from "./routeResponse";
import { releaseMonth } from "./releaseForDate";
import type { RouteRequest } from "./routing";
import { handleIndexRoutes } from "./indexRoutes";
import { handleOpenapiRoutes, isOpenapiRoute } from "./openapiRoutes";
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
import { handleAreaCapabilityRoutes } from "./areaCapabilityRoutes";
import { handleAreaCitationRoutes } from "./areaCitationRoutes";
import { handleAreaGeometryRoutes } from "./areaGeometryRoutes";
import { handleAreaGeometryMetadataRoutes } from "./areaGeometryMetadataRoutes";
import { handleTranslationRoutes } from "./translationRoutes";
import { handleRelationshipRoutes } from "./relationshipRoutes";
import { handleRelationshipRepairRoutes } from "./relationshipRepairRoutes";
import { handleGeographyHealthRoutes } from "./geographyHealthRoutes";
import { handleGovernanceRoutes } from "./governanceRoutes";
import { handleLocationRoutes } from "./locationRoutes";
import { handleCrosswalkRoutes } from "./crosswalkRoutes";
import { handleBulkRoutes } from "./bulkRoutes";
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
		name: "map-resources",
		owns: (segments) =>
			segments[0] === "v1" && segments[1] === "map-resources",
		handle: handleMapResourceRoutes,
	},
	{
		name: "boundaries",
		owns: (segments) =>
			segments[0] === "v1" &&
			!joinRelease(segments) &&
			[
				"geographies",
				"geography-inventory",
				"boundary-releases",
				"boundary-releases:resolve",
				"boundary-releases:compare",
			].includes(segments[1] ?? ""),
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
		owns: (segments) =>
			segments[0] === "v1" &&
			(segments[1] === "datasets" ||
				(segments[1] === "measures" && segments.length <= 3)),
		handle: handleCatalogueRoutes,
	},
	{
		name: "terrain",
		owns: (segments) => segments[0] === "v1" && segments[1] === "terrain",
		handle: handleTerrainRoutes,
	},
	{
		name: "coordinates",
		owns: (segments) =>
			segments.length === 2 &&
			segments[0] === "v1" &&
			segments[1] === "coordinates:convert",
		handle: handleCoordinateRoutes,
	},
	{
		name: "measure-compatibility",
		owns: (segments) =>
			segments[0] === "v1" &&
			segments[1] === "measures" &&
			segments[3] === "compatibility",
		handle: handleMeasureCompatibilityRoutes,
	},
	{
		name: "measure-reconciliation",
		owns: (segments) =>
			segments[0] === "v1" &&
			segments[1] === "measures" &&
			segments[3] === "reconciliation",
		handle: handleMeasureReconciliationRoutes,
	},
	{
		name: "measure-coverage-plan",
		owns: (segments) =>
			segments[0] === "v1" &&
			segments[1] === "measures" &&
			segments[3] === "coverage-plan",
		handle: handleCoveragePlanRoutes,
	},
	{
		name: "measure-coverage",
		owns: (segments) =>
			segments[0] === "v1" &&
			segments[1] === "measures" &&
			segments[3] === "coverage",
		handle: handleMeasureCoverageRoutes,
	},
	{
		name: "measure-quality",
		owns: (segments) =>
			segments[0] === "v1" &&
			segments[1] === "measures" &&
			segments[3] === "quality",
		handle: handleMeasureQualityRoutes,
	},
	{
		name: "analysis-geographies",
		owns: (segments) =>
			segments[0] === "v1" &&
			(segments[1] === "analysis-geographies" ||
				segments[1] === "analysis-geography-validation" ||
				segments[1] === "analysis:plan" ||
				(segments[1] === "measures" &&
					segments[3] === "conversion-support")),
		handle: handleAnalysisGeographyRoutes,
	},
	{
		name: "data",
		owns: (segments) =>
			segments.length === 3 &&
			segments[0] === "v1" &&
			segments[1] === "data",
		handle: handleDataRoutes,
	},
	{
		name: "data-series",
		owns: (segments) =>
			segments.length === 4 &&
			segments[0] === "v1" &&
			segments[1] === "data" &&
			segments[3] === "series",
		handle: handleDataSeriesRoutes,
	},
	{
		name: "data-rankings",
		owns: (segments) =>
			segments.length === 4 &&
			segments[0] === "v1" &&
			segments[1] === "data" &&
			segments[3] === "rankings",
		handle: handleDataRankingRoutes,
	},
	{
		name: "data-change",
		owns: (segments) =>
			segments.length === 4 &&
			segments[0] === "v1" &&
			segments[1] === "data" &&
			segments[3] === "change",
		handle: handleDataChangeRoutes,
	},
	{
		name: "data-value",
		owns: (segments) =>
			segments.length === 4 &&
			segments[0] === "v1" &&
			segments[1] === "data" &&
			segments[3] === "value",
		handle: handleDataValueRoutes,
	},
	{
		name: "places",
		owns: (segments) => segments[0] === "v1" && segments[1] === "places",
		handle: handlePlaceRoutes,
	},
	{
		name: "postcodes",
		owns: (segments) => segments[0] === "v1" && segments[1] === "postcodes",
		handle: handlePostcodeRoutes,
	},
	{
		name: "postcodes-batch",
		owns: (segments) =>
			segments.length === 2 &&
			segments[0] === "v1" &&
			segments[1] === "postcodes:batch",
		handle: handlePostcodeBatchRoutes,
		acceptsPost: true,
	},
	{
		name: "data-transforms",
		owns: (segments) =>
			segments.length === 4 &&
			segments[0] === "v1" &&
			segments[1] === "data" &&
			segments[3] === "compare",
		handle: handleDataTransformRoutes,
	},
	{
		name: "data-aggregate",
		owns: (segments) =>
			segments.length === 4 &&
			segments[0] === "v1" &&
			segments[1] === "data" &&
			segments[3] === "aggregate",
		handle: handleDataAggregateRoutes,
	},
	{
		name: "data-conversion",
		owns: (segments) =>
			segments.length === 4 &&
			segments[0] === "v1" &&
			segments[1] === "data" &&
			segments[3] === "convert",
		handle: handleDataConversionRoutes,
	},
	{
		name: "area-search",
		owns: (segments) =>
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments.length === 2,
		handle: handleAreaSearchRoutes,
	},
	{
		name: "area-contains",
		owns: (segments) =>
			segments[0] === "v1" && segments[1] === "areas:contains",
		handle: handleAreaContainsRoutes,
	},
	{
		name: "area-contains-batch",
		owns: (segments) =>
			segments[0] === "v1" && segments[1] === "areas:containsBatch",
		handle: handleAreaContainsBatchRoutes,
		acceptsPost: true,
	},
	{
		name: "area-near",
		owns: (segments) =>
			segments[0] === "v1" && segments[1] === "areas:near",
		handle: handleAreaNearRoutes,
	},
	{
		name: "area-intersects",
		owns: (segments) =>
			segments.length === 2 &&
			segments[0] === "v1" &&
			segments[1] === "areas:intersects",
		handle: handleAreaIntersectsRoutes,
	},
	{
		name: "area-validation",
		owns: (segments) =>
			segments[0] === "v1" && segments[1] === "areas:validate",
		handle: handleAreaValidationRoutes,
		acceptsPost: true,
	},
	{
		name: "area-identity",
		owns: (segments) =>
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments.length === 5,
		handle: handleAreaIdentityRoutes,
	},
	{
		name: "area-history",
		owns: (segments) =>
			segments.length === 6 &&
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments[5] === "history",
		handle: handleAreaHistoryRoutes,
	},
	{
		name: "area-relationships",
		owns: (segments) =>
			segments.length === 6 &&
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			["parents", "children", "relationships"].includes(segments[5]!),
		handle: handleAreaRelationshipRoutes,
	},
	{
		name: "area-child-geometry",
		owns: (segments) =>
			segments.length === 7 &&
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments[5] === "children" &&
			segments[6] === "geometry",
		handle: handleAreaChildGeometryRoutes,
	},
	{
		name: "area-neighbours",
		owns: (segments) =>
			segments.length === 6 &&
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments[5] === "neighbours",
		handle: handleAreaNeighbourRoutes,
	},
	{
		name: "area-overlap",
		owns: (segments) =>
			segments.length === 6 &&
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments[5] === "overlap",
		handle: handleAreaOverlapRoutes,
	},
	{
		name: "area-capabilities",
		owns: (segments) =>
			segments.length === 6 &&
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments[5] === "capabilities",
		handle: handleAreaCapabilityRoutes,
	},
	{
		name: "area-citation",
		owns: (segments) =>
			segments.length === 6 &&
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments[5] === "citation",
		handle: handleAreaCitationRoutes,
	},
	{
		name: "area-geometry",
		owns: (segments) =>
			segments.length === 6 &&
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments[5] === "geometry",
		handle: handleAreaGeometryRoutes,
	},
	{
		name: "area-geometry-metadata",
		owns: (segments) =>
			segments.length === 7 &&
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments[5] === "geometry" &&
			segments[6] === "metadata",
		handle: handleAreaGeometryMetadataRoutes,
	},
	{
		name: "translations",
		owns: (segments) =>
			segments.length === 2 &&
			segments[0] === "v1" &&
			segments[1] === "translations",
		handle: handleTranslationRoutes,
	},
	{
		name: "geography-health",
		owns: (segments) =>
			segments.length === 2 &&
			segments[0] === "v1" &&
			segments[1] === "geography-health",
		handle: handleGeographyHealthRoutes,
	},
	{
		name: "relationships",
		owns: (segments) =>
			segments.length === 2 &&
			segments[0] === "v1" &&
			segments[1] === "relationships",
		handle: handleRelationshipRoutes,
	},
	{
		name: "relationship-repairs",
		owns: (segments) =>
			segments.length === 2 &&
			segments[0] === "v1" &&
			segments[1] === "relationship-repairs",
		handle: handleRelationshipRepairRoutes,
	},
	{
		name: "governance",
		owns: (segments) =>
			segments[0] === "v1" &&
			["attribution", "corrections", "relationship-candidates"].includes(
				segments[1] ?? "",
			),
		handle: handleGovernanceRoutes,
	},
	{
		name: "locations",
		owns: (segments) => segments[0] === "v1" && segments[1] === "locations",
		handle: handleLocationRoutes,
	},
	{
		name: "crosswalks",
		owns: (segments) =>
			segments[0] === "v1" && segments[1] === "crosswalks",
		handle: handleCrosswalkRoutes,
	},
	{
		name: "bulk",
		owns: (segments) =>
			segments[0] === "v1" &&
			["exports", "lookups"].includes(segments[1] ?? ""),
		handle: handleBulkRoutes,
	},
	{
		name: "sync",
		owns: (segments) =>
			segments[0] === "v1" &&
			["atlas-release", "validation"].includes(segments[1] ?? ""),
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
