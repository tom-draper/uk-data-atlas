import { z } from "zod";
import type { ApiResponse } from "../runtime/index.ts";
import { placesMetadata } from "./placesMetadata";
import { postcodeBatchMetadata } from "./postcodeBatchMetadata";
import { postcodeMetadata } from "./postcodeMetadata";

/**
 * A postcode answer lists every area it falls in, and a batch up to a hundred
 * of them, so the body is not parsed per request to check it.
 */
const servedAsBuilt = (answer: ApiResponse) => answer;

export const placesContract = {
	method: "get",
	path: "/places",
	operationId: placesMetadata.operationId,
	tags: placesMetadata.tags,
	summary: placesMetadata.summary,
	description: placesMetadata.description,
	"x-likely-refusal": placesMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: placesMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
} as const;

export const postcodeContract = {
	method: "get",
	path: "/postcodes/:postcode",
	operationId: postcodeMetadata.operationId,
	tags: postcodeMetadata.tags,
	summary: postcodeMetadata.summary,
	description: postcodeMetadata.description,
	"x-likely-refusal": postcodeMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: postcodeMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
	validate: servedAsBuilt,
} as const;

export const postcodeBatchContract = {
	method: "post",
	path: "/postcodes::batch",
	operationId: postcodeBatchMetadata.operationId,
	tags: postcodeBatchMetadata.tags,
	summary: postcodeBatchMetadata.summary,
	description: postcodeBatchMetadata.description,
	"x-rate-limit-cost": postcodeBatchMetadata["x-rate-limit-cost"],
	"x-likely-refusal": postcodeBatchMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: postcodeBatchMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
	validate: servedAsBuilt,
} as const;
