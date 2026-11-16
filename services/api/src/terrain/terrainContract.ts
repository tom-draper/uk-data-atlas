import { z } from "zod";
import { terrainMetadata } from "./terrainMetadata";
import { terrainPointMetadata } from "./terrainPointMetadata";
import { terrainProductMetadata } from "./terrainProductMetadata";

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
	}) as const;

export const terrainCatalogueContract = route("/terrain", terrainMetadata);
export const terrainProductContract = route(
	"/terrain/:terrainId",
	terrainProductMetadata,
);
export const terrainPointContract = route(
	"/terrain/elevation/point",
	terrainPointMetadata,
);
