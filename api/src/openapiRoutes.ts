import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/**
 * The OpenAPI description this server implements, served as the document
 * itself. The index links to it, so a client can find the binding contract
 * from the API rather than from the repository.
 */
export const handleOpenapiRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "openapi.yaml"
	)
		return undefined;
	const { openapiDocument } = context;
	if (!openapiDocument)
		return problem(
			503,
			"Description Unavailable",
			"The server was started without its OpenAPI description.",
		);
	return {
		status: 200,
		body: envelope(releaseId, {
			title: "UK Data Atlas API",
			format: "openapi-3.1",
			href: "/v1/openapi.yaml",
		}),
		representation: {
			contentType: "application/yaml",
			body: openapiDocument,
		},
	};
};
