import { z } from "zod";
import { relationshipsMetadata } from "./relationshipsMetadata";

export const relationshipsContract = {
	method: "get",
	path: "/relationships",
	operationId: relationshipsMetadata.operationId,
	tags: relationshipsMetadata.tags,
	summary: relationshipsMetadata.summary,
	description: relationshipsMetadata.description,
	"x-likely-refusal": relationshipsMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: relationshipsMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
} as const;
