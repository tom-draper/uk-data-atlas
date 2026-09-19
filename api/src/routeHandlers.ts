import type { ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { handleIndexRoutes } from "./indexRoutes";
import { handleOpenapiRoutes } from "./openapiRoutes";
import { handleMapResourceRoutes } from "./mapResourceRoutes";
import { handlePinnedRoutes } from "./pinnedRoutes";
import { handleBoundaryRoutes } from "./boundaryRoutes";
import { handleCatalogueRoutes } from "./catalogueRoutes";
import { handleMeasureCompatibilityRoutes } from "./measureCompatibilityRoutes";
import { handleMeasureCoverageRoutes } from "./measureCoverageRoutes";
import { handleMeasureQualityRoutes } from "./measureQualityRoutes";
import { handleDataRoutes } from "./dataRoutes";
import { handleDataSeriesRoutes } from "./dataSeriesRoutes";
import { handleDataRankingRoutes } from "./dataRankingRoutes";
import { handleDataChangeRoutes } from "./dataChangeRoutes";
import { handleDataValueRoutes } from "./dataValueRoutes";
import { handlePlaceRoutes } from "./placeRoutes";
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
import { handleRelationshipPathRoutes } from "./relationshipPathRoutes";
import { handleGovernanceRoutes } from "./governanceRoutes";
import { handleLocationRoutes } from "./locationRoutes";
import { handleCrosswalkRoutes } from "./crosswalkRoutes";
import { handleBulkRoutes } from "./bulkRoutes";
import { handleSyncRoutes } from "./syncRoutes";

export type RouteHandler = (request: RouteRequest) => ApiResponse | undefined;

type RouteFamily = {
	name: string;
	owns: (segments: string[]) => boolean;
	handle: RouteHandler;
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
		owns: (segments) =>
			segments.length === 2 &&
			segments[0] === "v1" &&
			(segments[1] === "openapi.yaml" || segments[1] === "docs"),
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
			[
				"geographies",
				"geography-inventory",
				"boundary-releases",
				"boundary-releases:resolve",
			].includes(segments[1] ?? ""),
		handle: handleBoundaryRoutes,
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
		name: "measure-compatibility",
		owns: (segments) =>
			segments[0] === "v1" &&
			segments[1] === "measures" &&
			segments[3] === "compatibility",
		handle: handleMeasureCompatibilityRoutes,
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
				segments[1] === "analysis:plan" ||
				(segments[1] === "measures" && segments[3] === "conversion-support")),
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
		name: "relationship-paths",
		owns: (segments) =>
			segments.length === 2 &&
			segments[0] === "v1" &&
			segments[1] === "relationship-paths",
		handle: handleRelationshipPathRoutes,
	},
	{
		name: "governance",
		owns: (segments) =>
			segments[0] === "v1" &&
			["attribution", "relationship-candidates"].includes(
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
			["atlas-release", "atlas-releases", "validation"].includes(
				segments[1] ?? "",
			) &&
			// A path below a release id is a pinned resource, not a manifest.
			!(segments[1] === "atlas-releases" && segments.length >= 4),
		handle: handleSyncRoutes,
	},
	{
		name: "pinned",
		owns: (segments) =>
			segments[0] === "v1" &&
			segments[1] === "atlas-releases" &&
			segments.length >= 4,
		handle: handlePinnedRoutes,
	},
];

/** The names of the families that claim a path; routing expects exactly one. */
export const routeFamiliesOwning = (segments: string[]) =>
	routeFamilies.filter(({ owns }) => owns(segments)).map(({ name }) => name);

export const handleRoute = (request: RouteRequest): ApiResponse | undefined => {
	const family = routeFamilies.find(({ owns }) => owns(request.segments));
	return family?.handle(request);
};
