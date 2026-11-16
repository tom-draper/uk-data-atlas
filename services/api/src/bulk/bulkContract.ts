import { z } from "zod";
import type { ApiResponse } from "../runtime/index.ts";
import { exportDetailMetadata } from "./exportDetailMetadata";
import { exportsMetadata } from "./exportsMetadata";
import { lookupDetailMetadata } from "./lookupDetailMetadata";
import { lookupsMetadata } from "./lookupsMetadata";

/**
 * A download is stored bytes or a file, in a format the caller chose, so the
 * body is not parsed per request to check it.
 */
const servedAsBuilt = (answer: ApiResponse) => answer;

export const bulkExports = {
	method: "get",
	path: "/exports",
	operationId: exportsMetadata.operationId,
	tags: exportsMetadata.tags,
	summary: exportsMetadata.summary,
	description: exportsMetadata.description,
	"x-likely-refusal": exportsMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: exportsMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
} as const;

export const bulkExportDetail = {
	method: "get",
	path: "/exports/:exportId",
	operationId: exportDetailMetadata.operationId,
	tags: exportDetailMetadata.tags,
	summary: exportDetailMetadata.summary,
	description: exportDetailMetadata.description,
	"x-likely-refusal": exportDetailMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: exportDetailMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
	validate: servedAsBuilt,
} as const;

export const bulkLookups = {
	method: "get",
	path: "/lookups",
	operationId: lookupsMetadata.operationId,
	tags: lookupsMetadata.tags,
	summary: lookupsMetadata.summary,
	description: lookupsMetadata.description,
	"x-likely-refusal": lookupsMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: lookupsMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
} as const;

export const bulkLookupDetail = {
	method: "get",
	path: "/lookups/:lookupId",
	operationId: lookupDetailMetadata.operationId,
	tags: lookupDetailMetadata.tags,
	summary: lookupDetailMetadata.summary,
	description: lookupDetailMetadata.description,
	"x-likely-refusal": lookupDetailMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: lookupDetailMetadata.responses["200"].description,
			content: { "text/csv": { schema: z.string() } },
		},
	},
	validate: servedAsBuilt,
} as const;
