import { z } from "zod";
import { datasetMetadata } from "./datasetMetadata";
import { measureMetadata } from "./measureMetadata";
import { datasetsMetadata } from "./datasetsMetadata";
import { measuresMetadata } from "./measuresMetadata";
import { themesMetadata } from "./themesMetadata";
import { modulesMetadata } from "./modulesMetadata";

const envelope = (data: z.ZodType) =>
	z.looseObject({
		apiVersion: z.literal("v1"),
		atlasRelease: z.string(),
		meta: z.looseObject({ nextCursor: z.string().nullable() }),
		data,
	});

/** Where a dataset sits in the registry, on every response that describes one. */
const taxonomy = {
	theme: z.string().optional(),
	topic: z.string().optional(),
	module: z.string().optional(),
};
const dataset = z.looseObject({
	...taxonomy,
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
const measureSource = z.looseObject({
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
});
const uncertainty = z.looseObject({
	kind: z.literal("confidence-interval"),
	level: z.number(),
	note: z.string(),
});
const evidence = z.looseObject({ evidence: z.string() });
/** One way a measure is broken down, and the members it is published for. */
const dimension = z.looseObject({
	id: z.string(),
	label: z.string(),
	total: z.string().optional(),
	members: z.array(
		z.looseObject({
			code: z.string(),
			label: z.string(),
			parent: z.string().optional(),
		}),
	),
});
const members = z.record(z.string(), z.string());
const measure = z.looseObject({
	...taxonomy,
	id: z.string(),
	label: z.string(),
	description: z.string(),
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
	uncertainty: uncertainty.optional(),
	notes: z.array(z.string()).optional(),
	aggregation: z.looseObject({ kind: z.string(), available: z.boolean() }),
	dimensions: z.array(dimension),
	defaults: members.optional(),
	series: z.array(
		z.looseObject({
			dimensions: members,
			datasetId: z.string().optional(),
			label: z.string(),
			unit: z.string().optional(),
			href: z.string(),
			sources: z.array(measureSource),
			notes: z.array(z.string()).optional(),
			uncertainty: uncertainty.optional(),
			documents: evidence.optional(),
		}),
	),
	sources: z.array(measureSource),
	availability: z.looseObject({
		sourceExact: z.literal(true),
		conversion: z.literal(false),
		aggregation: z.boolean(),
	}),
	links: z.looseObject({ data: z.string() }),
	documents: evidence.optional(),
	matchedMembers: z
		.array(
			z.looseObject({
				dimension: z.string(),
				member: z.string(),
				label: z.string(),
				href: z.string(),
			}),
		)
		.optional(),
});

const datasetLinks = z.looseObject({ datasets: z.string() });
const theme = z.looseObject({
	id: z.string(),
	label: z.string(),
	description: z.string(),
	modules: z.array(z.string()),
	datasetCount: z.number(),
	links: datasetLinks,
	topics: z.array(
		z.looseObject({
			id: z.string(),
			label: z.string(),
			description: z.string(),
			module: z.string(),
			modules: z.array(z.string()).optional(),
			datasetCount: z.number(),
			links: datasetLinks,
		}),
	),
});
const catalogueModule = z.looseObject({
	id: z.string(),
	kind: z.enum(["theme", "foundation"]),
	label: z.string(),
	description: z.string(),
	themes: z.array(z.string()),
	topics: z.array(
		z.looseObject({
			id: z.string(),
			label: z.string(),
			theme: z.string(),
			description: z.string().optional(),
		}),
	),
	datasetCount: z.number(),
	links: datasetLinks.optional(),
	schemaVersion: z.number().optional(),
	alwaysIncluded: z.boolean().optional(),
	requires: z.array(z.string()).optional(),
	addOns: z.array(z.string()).optional(),
	compatibility: z.looseObject({ core: z.string() }).optional(),
	licences: z
		.array(
			z.looseObject({
				id: z.string(),
				name: z.string(),
				url: z.string(),
				commercialUse: z.boolean(),
				shareAlike: z.boolean(),
			}),
		)
		.nullable()
		.optional(),
	licenceConflict: z
		.looseObject({
			kind: z.string(),
			shareAlike: z.array(z.string()),
			others: z.array(z.string()),
			datasets: z.array(z.string()),
		})
		.nullable()
		.optional(),
	datasets: z
		.array(
			z.looseObject({
				id: z.string(),
				title: z.string(),
				topic: z.string(),
				partial: z.boolean().optional(),
			}),
		)
		.optional(),
	build: z
		.looseObject({
			status: z.string(),
			bytes: z.number().nullable(),
			files: z.unknown().nullable(),
		})
		.optional(),
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

export const themes = {
	...themesMetadata,
	method: "get",
	path: "/themes",
	responses: {
		...themesMetadata.responses,
		200: {
			...themesMetadata.responses[200],
			content: {
				"application/json": {
					...themesMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(z.array(theme)),
				},
			},
		},
	},
} as const;
export const modules = {
	...modulesMetadata,
	method: "get",
	path: "/modules",
	responses: {
		...modulesMetadata.responses,
		200: {
			...modulesMetadata.responses[200],
			content: {
				"application/json": {
					...modulesMetadata.responses[200].content[
						"application/json"
					],
					schema: envelope(z.array(catalogueModule)),
				},
			},
		},
	},
} as const;
