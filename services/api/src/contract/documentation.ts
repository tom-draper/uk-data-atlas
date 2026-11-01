import { z } from "zod";

export const documentation = {
	method: "get",
	path: "/docs",
	operationId: "getDocumentation",
	tags: ["Start here"],
	summary: "The human documentation landing page",
	"x-likely-refusal": {
		status: 503,
		when: "Takes no input. Refused only when the server was started without its OpenAPI description.",
	},
	description:
		"An HTML page rendered from this document: an endpoint chooser that starts from the job, the glossary of the identities a response carries, three copy-paste quick starts for a correct map, a defensible trend and a reliable sync, and every operation grouped by task with its most likely refusal. It is read from `x-endpoint-chooser`, `x-glossary`, `x-quick-starts` and each operation's `x-likely-refusal`, so it cannot describe a route this document does not, and every quick start request is sent as a contract test.\n",
	responses: {
		200: {
			description: "The documentation page.",
			content: { "text/html": { schema: z.string() } },
		},
		503: { $ref: "#/components/responses/CatalogueUnavailable" },
	},
} as const;
