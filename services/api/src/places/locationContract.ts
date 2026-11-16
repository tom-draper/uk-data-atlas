import { z } from "zod";
import type { ApiResponse } from "../runtime/index.ts";
import { locationAlternativesMetadata } from "./locationAlternativesMetadata";
import { locationComparisonMetadata } from "./locationComparisonMetadata";
import { locationGeometryMetadata } from "./locationGeometryMetadata";
import { locationMembersMetadata } from "./locationMembersMetadata";
import { locationMetadata } from "./locationMetadata";
import { locationParentsMetadata } from "./locationParentsMetadata";
import { locationsMetadata } from "./locationsMetadata";

/**
 * A location's geometry and its members can run to thousands of entries, so
 * the body is not parsed per request to check it.
 */
const servedAsBuilt = (answer: ApiResponse) => answer;

const route = <
	Path extends string,
	Metadata extends {
		operationId: string;
		tags: readonly string[];
		summary: string;
		"x-likely-refusal": unknown;
		responses: { "200": { description: string } };
	},
>(
	path: Path,
	metadata: Metadata & { description?: string },
) =>
	({
		method: "get",
		path,
		operationId: metadata.operationId,
		tags: metadata.tags,
		summary: metadata.summary,
		description: metadata.description,
		"x-likely-refusal": metadata["x-likely-refusal"],
		responses: {
			200: {
				description: metadata.responses["200"].description,
				content: { "application/json": { schema: z.looseObject({}) } },
			},
		},
		validate: servedAsBuilt,
	}) as const;

export const locationsContract = route("/locations", locationsMetadata);
export const locationAlternativesContract = route(
	"/locations/alternatives",
	locationAlternativesMetadata,
);
export const locationContract = route(
	"/locations/:locationId",
	locationMetadata,
);
export const locationComparisonContract = route(
	"/locations/:locationId/comparison",
	locationComparisonMetadata,
);
export const locationGeometryContract = route(
	"/locations/:locationId/geometry",
	locationGeometryMetadata,
);
export const locationMembersContract = route(
	"/locations/:locationId/members",
	locationMembersMetadata,
);
export const locationParentsContract = route(
	"/locations/:locationId/parents",
	locationParentsMetadata,
);
