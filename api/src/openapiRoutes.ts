import { docsPage } from "./docsPage";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/**
 * The OpenAPI description this server implements, served as the document
 * itself, and the human landing page rendered from it. The index links to
 * both, so a client can find the binding contract from the API rather than
 * from the repository, and a person can read it.
 */
export const handleOpenapiRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		(segments[1] !== "openapi.yaml" && segments[1] !== "docs")
	)
		return undefined;
	const { openapiDocument } = context;
	if (!openapiDocument)
		return problem(
			503,
			"Description Unavailable",
			"The server was started without its OpenAPI description.",
		);
	if (segments[1] === "docs")
		return {
			status: 200,
			body: envelope(releaseId, {
				title: "UK Data Atlas API documentation",
				href: "/v1/docs",
				describes: "/v1/openapi.yaml",
			}),
			representation: {
				contentType: "text/html; charset=utf-8",
				body: docsPage(openapiDocument, releaseId),
			},
		};
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
