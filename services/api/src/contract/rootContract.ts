import { z } from "zod";
import { rootMetadata } from "./rootMetadata";

export const rootDocument = z.looseObject({
	name: z.string(),
	openapi: z
		.string()
		.describe("This OpenAPI description, the binding contract.")
		.optional(),
	documentation: z
		.string()
		.describe("The human landing page rendered from it.")
		.optional(),
	links: z.array(z.string()),
});

export const rootEnvelope = z.looseObject({
	apiVersion: z.literal("v1"),
	atlasRelease: z.string(),
	meta: z.looseObject({ nextCursor: z.string().nullable() }),
	data: rootDocument,
});

export const rootContract = {
	method: "get",
	path: "/",
	operationId: rootMetadata.operationId,
	tags: rootMetadata.tags,
	summary: rootMetadata.summary,
	description: rootMetadata.description,
	"x-likely-refusal": rootMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: rootMetadata.responses["200"].description,
			content: { "application/json": { schema: rootEnvelope } },
		},
	},
} as const;
