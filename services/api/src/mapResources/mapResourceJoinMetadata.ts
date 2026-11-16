export const mapResourceJoinMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/Geography",
		},
		{
			$ref: "#/components/parameters/Release",
		},
		{
			$ref: "#/components/parameters/MeasureId",
		},
		{
			name: "period",
			in: "query",
			required: true,
			description: "The observation period the values describe.",
			schema: {
				type: "string",
			},
		},
		{
			name: "geography",
			in: "query",
			description:
				"The measure's source geography, where it publishes more than one partition. Without it an ambiguous request is refused with the partitions listed rather than one being chosen by catalogue order.\n",
			schema: {
				type: "string",
			},
		},
		{
			name: "codeYear",
			in: "query",
			description:
				"The measure's source boundary year, alongside `geography`.",
			schema: {
				type: "integer",
			},
		},
		{
			name: "format",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["json", "parquet"],
				default: "json",
			},
			description:
				"`json` for the envelope a renderer reads, `parquet` for the same rows as a Parquet file.\n",
		},
	],
	operationId: "getMapResourceJoin",
	tags: ["Geography"],
	summary: "One measure's values, numbered to match this resource's tiles",
	"x-likely-refusal": {
		status: 422,
		code: "incompatible_geometry",
		when: "The measure is published on areas this release does not hold, so its values cannot be drawn on it. The refusal names the releases that would carry it.",
		"x-example-request":
			"/v1/map-resources/localAuthority/2023-05-uk-bgc-v2/join/imd-rank?period=2025",
	},
	description:
		"The values a renderer joins to the tiles, as `id`, `code` and `value`. The `id` is the same integer the tile carries, so a renderer sets feature state by it without reading the geometry. Values are joined to this release by matching area code and are never converted: a measure whose source codes are not all in this release is refused with `incompatible_geometry`, and the refusal names the releases that would carry it. Keeping values out of the tiles is what lets one tileset serve every measure, and lets a corrected value invalidate a small table rather than a whole pyramid.\n\nWith `format=parquet` the same table is served as a Parquet file with `id`, `code`, `value` and `status` columns, for a warehouse to join to the GeoParquet `features`. Everything the JSON envelope says about the table, from the Atlas release to the join rule and provenance, travels in the file's `uk-data-atlas` metadata.\nBoth formats accept at most 250,000 source records and 16 MiB of uncompressed column payload. The byte budget counts 20 bytes per numeric row for id, value and string-length prefixes, plus the UTF-8 code and status bytes. Oversized joins return `422 Map Join Budget Exceeded` before output rows or columns are built, with no partial table and a `links.data` URL for paginated source observations. Source artifact parsing and record materialisation occur before this check; this is not a heap or RSS ceiling.\n",
	responses: {
		"200": {
			description:
				"The values, numbered as the tiles number their features.",
			content: {
				"application/vnd.apache.parquet": {
					schema: {
						type: "string",
						format: "binary",
					},
				},
				"application/json": {
					schema: {
						$ref: "#/components/schemas/MapResourceJoinEnvelope",
					},
					"x-example-request":
						"/v1/map-resources/localAuthority/2023-05-uk-bgc-v2/join/population?period=2022&geography=localAuthority&codeYear=2023",
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"422": {
			description:
				"The source codes cannot be drawn on this release, or the join exceeds its record or uncompressed column-byte budget.\n",
			content: {
				"application/problem+json": {
					schema: {
						oneOf: [
							{
								$ref: "#/components/schemas/IncompatibleGeometryProblem",
							},
							{
								$ref: "#/components/schemas/MapJoinBudgetProblem",
							},
						],
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
