import { z } from "zod";
import type { ApiResponse } from "../runtime/index.ts";

/**
 * A page of areas, a validated column, a tile or a download can run to many
 * entries or bytes, so the body is not parsed per request to check it.
 */
export const servedAsBuilt = (answer: ApiResponse) => answer;

type Metadata = {
	operationId: string;
	tags: readonly string[];
	summary: string;
	description?: string;
	"x-rate-limit-cost"?: number;
	"x-likely-refusal"?: unknown;
	responses: { "200": { description: string } };
};

export const route = <Method extends "get" | "post", Path extends string>(
	method: Method,
	path: Path,
	metadata: Metadata,
) =>
	({
		method,
		path,
		operationId: metadata.operationId,
		tags: metadata.tags,
		summary: metadata.summary,
		description: metadata.description,
		...(metadata["x-rate-limit-cost"] === undefined
			? {}
			: { "x-rate-limit-cost": metadata["x-rate-limit-cost"] }),
		...(metadata["x-likely-refusal"] === undefined
			? {}
			: { "x-likely-refusal": metadata["x-likely-refusal"] }),
		responses: {
			200: {
				description: metadata.responses["200"].description,
				content: { "application/json": { schema: z.looseObject({}) } },
			},
		},
		validate: servedAsBuilt,
	}) as const;
