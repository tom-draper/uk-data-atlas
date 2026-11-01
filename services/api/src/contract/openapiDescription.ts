import { z } from "zod";

export const openapiDescription = {
	method: "get",
	path: "/openapi.yaml",
	operationId: "getOpenapiDescription",
	tags: ["Start here"],
	summary: "The OpenAPI description of this API",
	"x-likely-refusal": {
		status: 503,
		when: "Takes no input. Refused only when the server was started without its OpenAPI document.",
	},
	description:
		"Returns this document, so a client can read the binding contract from the running API rather than the repository. The response is the YAML document itself; `Accept` is not negotiated on any route, and a route's representations are chosen with `format` where it offers more than one.\n",
	responses: {
		200: {
			description: "The OpenAPI 3.1 description.",
			content: { "application/yaml": { schema: z.string() } },
		},
		503: { $ref: "#/components/responses/CatalogueUnavailable" },
	},
} as const;
