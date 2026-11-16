export const exportDetailMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/ExportId",
		},
		{
			name: "format",
			in: "query",
			schema: {
				type: "string",
				enum: ["json", "csv", "parquet"],
				default: "json",
			},
		},
	],
	operationId: "downloadBulkExport",
	tags: ["Sync"],
	summary: "Download one immutable source observation artifact",
	"x-likely-refusal": {
		status: 404,
		when: "A measure id is given where an export id is asked for. An export is one source partition; `/v1/exports` lists them.",
		"x-example-request": "/v1/exports/population",
	},
	description:
		"Defaults to the source JSON artifact. Use `format=csv` or `format=parquet` for a prebuilt flat file of the named measure across all periods. Shared tables are projected to that measure, preserving null cells. Rows carry measureId, unit, datasetId, geography, boundaryYear, period, areaCode, sourceAreaCode, value, category, status, lowerBound and upperBound. Missing fields are empty in CSV and null in Parquet. Sizes and hashes for the flat files are listed in each export's `formats`. The response is not wrapped in the usual API envelope.\n",
	responses: {
		"200": {
			description: "The complete source observation artifact.",
			headers: {
				"Content-Disposition": {
					schema: {
						type: "string",
					},
					description: "Suggested filename for the selected format.",
				},
			},
			content: {
				"application/json": {
					schema: {
						type: "object",
					},
					"x-example-request": "/v1/exports/total-jobs-observations",
					example: {
						schemaVersion: 1,
						measureId: "total-jobs",
					},
				},
				"text/csv": {
					schema: {
						type: "string",
					},
				},
				"application/vnd.apache.parquet": {
					schema: {
						type: "string",
						format: "binary",
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
