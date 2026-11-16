export const lookupDetailMetadata = {
	parameters: [
		{
			name: "lookup-id",
			in: "path",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"A lookup id from `GET /v1/lookups`, such as `areas-ward-2024-12-uk-bgc`.\n",
		},
		{
			name: "format",
			in: "query",
			required: false,
			schema: {
				enum: ["csv", "ndjson"],
				default: "csv",
			},
			description:
				"The representation to download. Both are rendered from the same artifact and hashed in the lookup manifest.\n",
		},
	],
	operationId: "downloadBulkLookup",
	tags: ["Sync"],
	summary: "Download one whole lookup table as CSV or NDJSON",
	"x-likely-refusal": {
		status: 400,
		code: "invalid_format",
		when: "The format is not `csv` or `ndjson`. A lookup is a table, and `/v1/lookups` describes it as JSON.",
		"x-example-request":
			"/v1/lookups/areas-combinedAuthority-2025-12-en-bgc?format=json",
	},
	description:
		'Renders the lookup from its source artifact and returns it only if the bytes match the hash its manifest lists for the format. In CSV a list column is joined with " | " and a cell is quoted only when it holds a comma, quote or line break; in NDJSON each line is one row with every column, lists as arrays and empty values as null. This response is intentionally not wrapped in the usual API envelope.\n',
	responses: {
		"200": {
			description: "The whole lookup table.",
			headers: {
				"Content-Disposition": {
					schema: {
						type: "string",
					},
					description:
						"Suggested filename, the lookup id with the format's extension.",
				},
			},
			content: {
				"text/csv": {
					schema: {
						type: "string",
					},
					"x-example-request":
						"/v1/lookups/areas-combinedAuthority-2025-12-en-bgc?format=csv",
					example:
						"geography,boundaryRelease,code,name,aliases\ncombinedAuthority,2025-12-en-bgc,E47000001,Greater Manchester,\ncombinedAuthority,2025-12-en-bgc,E47000002,South Yorkshire,\n",
				},
				"application/x-ndjson": {
					schema: {
						type: "string",
					},
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
