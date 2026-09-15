import type { ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { handleGovernanceRoutes } from "./governanceRoutes";
import { handleSyncRoutes } from "./syncRoutes";

export type RouteHandler = (request: RouteRequest) => ApiResponse | undefined;

/**
 * Handlers claim only the paths in their resource domain. This makes the
 * router's fall-through explicit and lets route families move independently.
 */
const handlers: RouteHandler[] = [handleSyncRoutes, handleGovernanceRoutes];

export const handleRoute = (request: RouteRequest): ApiResponse | undefined => {
	for (const handler of handlers) {
		const response = handler(request);
		if (response) return response;
	}
	return undefined;
};
