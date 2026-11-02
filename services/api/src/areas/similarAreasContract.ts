import { z } from "zod";
import { similarAreasMetadata } from "./similarAreasMetadata";

const envelope = (data: z.ZodType) =>
	z.looseObject({
		apiVersion: z.literal("v1"),
		atlasRelease: z.string(),
		meta: z.looseObject({ nextCursor: z.string().nullable() }),
		data,
	});

export const similarAreasContract = {
	...similarAreasMetadata,
	method: "get",
	path: "/areas/:geography/:code/similar",
	responses: {
		...similarAreasMetadata.responses,
		200: {
			...similarAreasMetadata.responses[200],
			content: {
				"application/json": {
					...similarAreasMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(
						z.looseObject({
							target: z.looseObject({
								geography: z.string(),
								code: z.string(),
							}),
							method: z.enum([
								"zscore-euclidean",
								"rank-euclidean",
							]),
							measures: z.array(
								z.looseObject({
									id: z.string(),
									period: z.string(),
									sourceGeography: z.looseObject({
										type: z.string(),
										codeYear: z.number().int(),
									}),
									mean: z.number(),
									standardDeviation: z.number(),
								}),
							),
							droppedAreaCount: z.number().int().nonnegative(),
							areas: z.array(
								z.looseObject({
									areaCode: z.string(),
									distance: z.number().nonnegative(),
									rank: z.number().int().positive(),
									values: z.record(z.string(), z.number()),
								}),
							),
						}),
					),
				},
			},
		},
	},
} as const;
