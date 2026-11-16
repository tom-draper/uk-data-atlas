import { z } from "zod";
import { envelopeSchema } from "../contract/envelopeSchema";
import { coordinateMetadata } from "./coordinateMetadata";

const point = z.looseObject({
	lng: z.number(),
	lat: z.number(),
	crs: z.literal("EPSG:4326"),
});

export const coordinateConversion = z.looseObject({
	point,
	targetCrs: z.enum(["EPSG:4326", "EPSG:27700", "EPSG:29902"]),
	target: z
		.looseObject({
			crs: z.enum(["EPSG:27700", "EPSG:29902"]),
			easting: z.number(),
			northing: z.number(),
			uncertaintyM: z.number(),
		})
		.optional(),
	note: z.string(),
});

export const coordinateContract = {
	method: "get",
	path: "/coordinates::convert",
	operationId: coordinateMetadata.operationId,
	tags: coordinateMetadata.tags,
	summary: coordinateMetadata.summary,
	description: coordinateMetadata.description,
	"x-likely-refusal": coordinateMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: coordinateMetadata.responses["200"].description,
			content: {
				"application/json": {
					schema: envelopeSchema(coordinateConversion),
				},
			},
		},
	},
} as const;
