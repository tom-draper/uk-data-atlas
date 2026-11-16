import { z } from "zod";
import { envelopeSchema } from "../contract/envelopeSchema";
import { attributionMetadata } from "./attributionMetadata";

export const attributionContract = {
	method: "get",
	path: "/attribution",
	operationId: attributionMetadata.operationId,
	tags: attributionMetadata.tags,
	summary: attributionMetadata.summary,
	description: attributionMetadata.description,
	"x-likely-refusal": attributionMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: attributionMetadata.responses["200"].description,
			content: {
				"application/json": {
					schema: envelopeSchema(z.looseObject({})),
				},
			},
		},
	},
} as const;
