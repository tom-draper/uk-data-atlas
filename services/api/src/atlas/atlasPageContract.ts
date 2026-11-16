import { z } from "zod";
import type { ApiResponse } from "../runtime/index.ts";
import { atlasPageMetadata } from "./atlasPageMetadata";

/**
 * A built atlas page is whatever JSON object the build wrote. Its bytes and
 * hash are the contract, so nothing narrower is declared.
 */
export const atlasPage = z.looseObject({});

/**
 * A page is served as the stored bytes it was built as, so it is not parsed per
 * request to check it against the schema.
 */
const servedAsStored = (answer: ApiResponse) => answer;

export const atlasPageContract = {
	method: "get",
	path: "/atlas-pages/:pageId",
	operationId: atlasPageMetadata.operationId,
	tags: atlasPageMetadata.tags,
	summary: atlasPageMetadata.summary,
	description: atlasPageMetadata.description,
	"x-likely-refusal": atlasPageMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: atlasPageMetadata.responses["200"].description,
			content: { "application/json": { schema: atlasPage } },
		},
	},
	validate: servedAsStored,
} as const;
