import type { ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
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
