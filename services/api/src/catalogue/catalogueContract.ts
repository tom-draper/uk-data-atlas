import { z } from "zod";
import { datasetMetadata } from "./datasetMetadata";
import { measureMetadata } from "./measureMetadata";
import { datasetsMetadata } from "./datasetsMetadata";
import { measuresMetadata } from "./measuresMetadata";

const envelope = (data: z.ZodType) =>
	z.looseObject({
		apiVersion: z.literal("v1"),
		atlasRelease: z.string(),
		meta: z.looseObject({ nextCursor: z.string().nullable() }),
		data,
	});

const dataset = z.looseObject({
	id: z.string(),
	label: z.string(),
	publisher: z.string(),
	description: z.string().optional(),
	sourceUrl: z.string(),
	temporalCoverage: z.string(),
	licence: z.looseObject({ name: z.string(), url: z.string().optional() }),
	inputs: z.array(
		z.looseObject({
			kind: z.string(),
			path: z.string(),
			bytes: z.number(),
			sha256: z.string(),
		}),
	),
	summary: z.looseObject({
		datasetCount: z.number(),
		dataRecordCount: z.number(),
		codeYears: z.array(z.number()),
	}),
	compiled: z.looseObject({ bytes: z.number(), sha256: z.string() }),
});
const measure = z.looseObject({
	id: z.string(),
	label: z.string(),
	valueKind: z.enum([
		"count",
		"quantity",
		"ratio",
		"currency",
		"ordinal",
		"categorical",
	]),
	unit: z.string(),
	unitDefinition: z
		.looseObject({
			code: z.string(),
			scaleToCanonical: z.number(),
			per: z.string().optional(),
		})
		.optional(),
	aliases: z.array(z.string()).optional(),
	concept: z.string().optional(),
	elsewhere: z
		.array(
			z.looseObject({
				measureId: z.string(),
				countries: z.array(z.string()),
				comparable: z.boolean(),
				reason: z.string(),
				href: z.string(),
			}),
		)
		.optional(),
	derivedFrom: z
		.looseObject({ datasetIds: z.array(z.string()), note: z.string() })
		.optional(),
	uncertainty: z
		.looseObject({
			kind: z.literal("confidence-interval"),
			level: z.number(),
			note: z.string(),
		})
		.optional(),
	notes: z.array(z.string()).optional(),
	aggregation: z.looseObject({ kind: z.string(), available: z.boolean() }),
	sources: z.array(
		z.looseObject({
			datasetId: z.string(),
			periods: z.array(z.string()),
			sourceGeography: z.looseObject({
				type: z.string(),
				codeYear: z.number(),
			}),
			observationArtifact: z.string().optional(),
			coverage: z.looseObject({
				kind: z.enum(["partial", "source-reported"]),
				countries: z.array(z.string()),
				recordCount: z.number(),
				note: z.string(),
			}),
		}),
	),
	availability: z.looseObject({
		sourceExact: z.literal(true),
		conversion: z.literal(false),
		aggregation: z.boolean(),
	}),
	links: z.looseObject({ data: z.string() }),
});

export const datasets = {
	...datasetsMetadata,
	method: "get",
	path: "/datasets",
	responses: {
		...datasetsMetadata.responses,
		200: {
			...datasetsMetadata.responses[200],
			content: {
				"application/json": {
					...datasetsMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(z.array(dataset)),
				},
			},
		},
	},
} as const;
export const measures = {
	...measuresMetadata,
	method: "get",
	path: "/measures",
	responses: {
		...measuresMetadata.responses,
		200: {
			...measuresMetadata.responses[200],
			content: {
				"application/json": {
					...measuresMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(z.array(measure)),
				},
			},
		},
	},
} as const;

export const datasetDetail = {
	...datasetMetadata,
	method: "get",
	path: "/datasets/:datasetId",
	responses: {
		...datasetMetadata.responses,
		200: {
			...datasetMetadata.responses[200],
			content: {
				"application/json": {
					...datasetMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(dataset),
				},
			},
		},
	},
} as const;
export const measureDetail = {
	...measureMetadata,
	method: "get",
	path: "/measures/:measureId",
	responses: {
		...measureMetadata.responses,
		200: {
			...measureMetadata.responses[200],
			content: {
				"application/json": {
					...measureMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(measure),
				},
			},
		},
	},
} as const;
