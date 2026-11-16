import { z } from "zod";
import type { ApiResponse } from "../runtime/index.ts";
import { releaseJoinMetadata } from "./releaseJoinMetadata";

/**
 * A join answers a table or, with `format=geojson`, a GeoJSON collection of
 * up to 64 MB, so the body is not parsed per request to check it.
 */
const servedAsBuilt = (answer: ApiResponse) => answer;

export const releaseJoinContract = {
	method: "post",
	path: "/boundary-releases/:geography/:release::join",
	operationId: releaseJoinMetadata.operationId,
	tags: releaseJoinMetadata.tags,
	summary: releaseJoinMetadata.summary,
	description: releaseJoinMetadata.description,
	"x-rate-limit-cost": releaseJoinMetadata["x-rate-limit-cost"],
	responses: {
		200: {
			description: releaseJoinMetadata.responses["200"].description,
			content: { "application/json": { schema: z.looseObject({}) } },
		},
	},
	validate: servedAsBuilt,
} as const;
