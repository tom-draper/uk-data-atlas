import { z } from "zod";
import { envelopeSchema } from "../contract/envelopeSchema";
import { analysisGeographiesMetadata } from "./analysisGeographiesMetadata";
import { analysisPlanMetadata } from "./analysisPlanMetadata";

export const analysisGeographiesContract = {
	method: "get",
	path: "/analysis-geographies",
	operationId: analysisGeographiesMetadata.operationId,
	tags: analysisGeographiesMetadata.tags,
	summary: analysisGeographiesMetadata.summary,
	description: analysisGeographiesMetadata.description,
	"x-likely-refusal": analysisGeographiesMetadata["x-likely-refusal"],
	responses: {
		200: {
			description:
				analysisGeographiesMetadata.responses["200"].description,
			content: {
				"application/json": {
					schema: envelopeSchema(
						z.looseObject({
							analysisGeographies: z.array(z.looseObject({})),
						}),
					),
				},
			},
		},
	},
} as const;

export const analysisPlanContract = {
	method: "get",
	path: "/analysis::plan",
	operationId: analysisPlanMetadata.operationId,
	tags: analysisPlanMetadata.tags,
	summary: analysisPlanMetadata.summary,
	description: analysisPlanMetadata.description,
	"x-likely-refusal": analysisPlanMetadata["x-likely-refusal"],
	responses: {
		200: {
			description: analysisPlanMetadata.responses["200"].description,
			content: {
				"application/json": {
					schema: envelopeSchema(z.looseObject({})),
				},
			},
		},
	},
} as const;
