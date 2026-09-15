import type { ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { handleBoundaryRoutes } from "./boundaryRoutes";
import { handleBulkRoutes } from "./bulkRoutes";
import { handleCrosswalkRoutes } from "./crosswalkRoutes";
import { handleLocationRoutes } from "./locationRoutes";
import { handleAreaSearchRoutes } from "./areaSearchRoutes";
import { handleAreaValidationRoutes } from "./areaValidationRoutes";
import { handleAreaContainsRoutes } from "./areaContainsRoutes";
import { handleCatalogueRoutes } from "./catalogueRoutes";
import { handleMeasureCoverageRoutes } from "./measureCoverageRoutes";
import { handleAreaHistoryRoutes } from "./areaHistoryRoutes";
import { handleAreaRelationshipRoutes } from "./areaRelationshipRoutes";
import { handleAreaIdentityRoutes } from "./areaIdentityRoutes";
import { handleMeasureCompatibilityRoutes } from "./measureCompatibilityRoutes";
import { handlePlaceRoutes } from "./placeRoutes";
import { handleGovernanceRoutes } from "./governanceRoutes";
import { handleSyncRoutes } from "./syncRoutes";

export type RouteHandler = (request: RouteRequest) => ApiResponse | undefined;

type RouteFamily = {
	name: string;
	owns: (segments: string[]) => boolean;
	handle: RouteHandler;
};

/**
 * Each family declares the resources it owns before it handles a request.
 * This keeps dispatch independent of handler order and makes a new route's
 * home explicit while the legacy router is split into domain modules.
 */
const routeFamilies: RouteFamily[] = [
	{
		name: "places",
		owns: (segments) => segments[0] === "v1" && segments[1] === "places",
		handle: handlePlaceRoutes,
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
		name: "area-identity",
		owns: (segments) =>
			segments[0] === "v1" &&
			segments[1] === "areas" &&
			segments.length === 5,
		handle: handleAreaIdentityRoutes,
	},
	{
		name: "area-relationships",
		owns: (segments) =>
			segments[0] === "v1" &&
			["parents", "children", "relationships"].includes(
				segments[5] ?? "",
			),
		handle: handleAreaRelationshipRoutes,
	},
	{
		name: "area-history",
		owns: (segments) => segments[0] === "v1" && segments[5] === "history",
		handle: handleAreaHistoryRoutes,
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
		name: "catalogue",
		owns: (segments) =>
			segments[0] === "v1" &&
			(segments[1] === "datasets" ||
				(segments[1] === "measures" && segments.length <= 3)),
		handle: handleCatalogueRoutes,
	},
	{
		name: "area-contains",
		owns: (segments) =>
			segments[0] === "v1" && segments[1] === "areas:contains",
		handle: handleAreaContainsRoutes,
	},
	{
		name: "area-validation",
		owns: (segments) =>
			segments[0] === "v1" && segments[1] === "areas:validate",
		handle: handleAreaValidationRoutes,
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
		name: "sync",
		owns: (segments) =>
			segments[0] === "v1" &&
			["atlas-release", "atlas-releases", "validation"].includes(
				segments[1] ?? "",
			),
		handle: handleSyncRoutes,
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
];

export const handleRoute = (request: RouteRequest): ApiResponse | undefined => {
	const family = routeFamilies.find(({ owns }) => owns(request.segments));
	return family?.handle(request);
};
