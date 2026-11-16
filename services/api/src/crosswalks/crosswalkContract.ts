import { z } from "zod";
import type { ApiResponse } from "../runtime/index.ts";
import { crosswalkConvertMetadata } from "./crosswalkConvertMetadata";
import { crosswalkDetailMetadata } from "./crosswalkDetailMetadata";
import { crosswalkRecordsMetadata } from "./crosswalkRecordsMetadata";
import { crosswalksMetadata } from "./crosswalksMetadata";

/**
 * A crosswalk's records and a conversion's rows can run to thousands of
 * entries, so the body is not parsed per request to check it.
 */
const servedAsBuilt = (answer: ApiResponse) => answer;

export const crosswalksContract = {
	method: "get",
	path: "/crosswalks",
	operationId: crosswalksMetadata.operationId,
	tags: crosswalksMetadata.tags,
	summary: crosswalksMetadata.summary,
	"x-likely-refusal": crosswalksMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: crosswalksMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
} as const;

export const crosswalkDetailContract = {
	method: "get",
	path: "/crosswalks/:crosswalkId",
	operationId: crosswalkDetailMetadata.operationId,
	tags: crosswalkDetailMetadata.tags,
	summary: crosswalkDetailMetadata.summary,
	description: crosswalkDetailMetadata.description,
	"x-likely-refusal": crosswalkDetailMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: crosswalkDetailMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
	validate: servedAsBuilt,
} as const;

export const crosswalkRecordsContract = {
	method: "get",
	path: "/crosswalks/:crosswalkId/records",
	operationId: crosswalkRecordsMetadata.operationId,
	tags: crosswalkRecordsMetadata.tags,
	summary: crosswalkRecordsMetadata.summary,
	"x-likely-refusal": crosswalkRecordsMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: crosswalkRecordsMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
	validate: servedAsBuilt,
} as const;

export const crosswalkConvertContract = {
	method: "post",
	path: "/crosswalks/:crosswalkId::convert",
	operationId: crosswalkConvertMetadata.operationId,
	tags: crosswalkConvertMetadata.tags,
	summary: crosswalkConvertMetadata.summary,
	description: crosswalkConvertMetadata.description,
	"x-rate-limit-cost": crosswalkConvertMetadata["x-rate-limit-cost"],
	responses: {
		200: {
			description: crosswalkConvertMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
	validate: servedAsBuilt,
} as const;
