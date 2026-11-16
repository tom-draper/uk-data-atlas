import { z } from "zod";
import type { ApiResponse } from "../runtime/index.ts";
import { atlasLookupMetadata } from "./atlasLookupMetadata";

/**
 * A built atlas lookup is whatever JSON object the build wrote. Its bytes and
 * hash are the contract, so nothing narrower is declared.
 */
export const atlasLookup = z.looseObject({});

/**
 * A lookup is served as the stored bytes it was built as, so it is not parsed per
 * request to check it against the schema.
 */
const servedAsStored = (answer: ApiResponse) => answer;

export const atlasLookupContract = {
	method: "get",
	path: "/atlas-lookups/:lookupId",
	operationId: atlasLookupMetadata.operationId,
	tags: atlasLookupMetadata.tags,
	summary: atlasLookupMetadata.summary,
	description: atlasLookupMetadata.description,
	"x-likely-refusal": atlasLookupMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: atlasLookupMetadata.responses["200"].description,
			content: { "application/json": { schema: atlasLookup } },
		},
	},
	validate: servedAsStored,
} as const;
