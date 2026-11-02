import { z } from "zod";

const file = z.object({
	path: z.string(),
	bytes: z.number(),
	contentHash: z.string(),
	gzipBytes: z.number().optional(),
});

export const measureExportMetadata = {
	operationId: "downloadMeasure",
	tags: ["Sync"],
	summary: "Download every observation for a measure",
	"x-likely-refusal": {
		status: 404,
		when: "The measure id or pinned content hash does not exist.",
		"x-example-request": "/v1/data/not-a-measure/export",
	},
	description:
		"Download a measure across all its published areas and periods. Rows are ordered by geography, boundary release, period, area code, dataset and series. CSV and Parquet contain the same rows, including dimension members, status and uncertainty bounds when available. A hash-pinned URL is immutable.",
	parameters: [
		{ $ref: "#/components/parameters/MeasureId" },
		{
			name: "format",
			in: "query",
			required: false,
			description: "Output format, default parquet.",
			schema: {
				type: "string",
				enum: ["parquet", "csv"],
				default: "parquet",
			},
		},
		{
			name: "hash",
			in: "query",
			required: false,
			description: "Pin the SHA-256 content hash for immutable caching.",
			schema: { type: "string", pattern: "^[0-9a-f]{64}$" },
		},
	],
	responses: {
		200: {
			description: "The whole measure as a file.",
			content: {
				"application/vnd.apache.parquet": {
					"x-example-request":
						"/v1/data/crime-burglary/export?format=parquet",
					schema: { type: "string", format: "binary" },
				},
				"text/csv": {
					"x-example-request":
						"/v1/data/crime-burglary/export?format=csv",
					schema: { type: "string", format: "binary" },
				},
			},
		},
		400: { $ref: "#/components/responses/InvalidQuery" },
		404: { $ref: "#/components/responses/NotFound" },
		503: { $ref: "#/components/responses/CatalogueUnavailable" },
	},
} as const;

export const measureExport = {
	...measureExportMetadata,
	method: "get",
	path: "/data/:measureId/export",
	responses: {
		...measureExportMetadata.responses,
		200: {
			description: measureExportMetadata.responses[200].description,
			content: {
				"application/vnd.apache.parquet": { schema: file },
				"text/csv": { schema: file },
			},
		},
	},
} as const;
