import { z } from "zod";
import { translationMetadata } from "./translationMetadata";

export const translationContract = {
	method: "get",
	path: "/translations",
	operationId: translationMetadata.operationId,
	tags: translationMetadata.tags,
	summary: translationMetadata.summary,
	description: translationMetadata.description,
	"x-likely-refusal": translationMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: translationMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
} as const;
