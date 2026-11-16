import { z } from "zod";
import type { ApiResponse } from "../runtime/index.ts";
import { documentMetadata } from "./documentMetadata";

/**
 * A build evidence document is whatever JSON object the build wrote. Its
 * bytes and hash are the contract, so nothing narrower is declared.
 */
export const evidenceDocument = z.looseObject({});

/**
 * A document is served as the stored bytes it was built as, some of them
 * megabytes, so it is not parsed per request to check it against the schema.
 */
const servedAsStored = (answer: ApiResponse) => answer;

export const documentContract = {
	method: "get",
	path: "/documents/:documentId",
	operationId: documentMetadata.operationId,
	tags: documentMetadata.tags,
	summary: documentMetadata.summary,
	description: documentMetadata.description,
	"x-likely-refusal": documentMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: documentMetadata.responses["200"].description,
			content: { "application/json": { schema: evidenceDocument } },
		},
	},
	validate: servedAsStored,
} as const;
