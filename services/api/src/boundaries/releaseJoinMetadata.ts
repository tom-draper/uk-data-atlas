export const releaseJoinMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Geography",
		},
		{
			$ref: "#/components/parameters/Release",
		},
		{
			name: "format",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["json", "geojson"],
				default: "json",
			},
			description:
				"`json` for the join table, `geojson` for the joined areas with their geometry.\n",
		},
		{
			name: "tier",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["full", "high", "medium", "low"],
				default: "medium",
			},
			description:
				"The geometry detail for `format=geojson`, as on the map resource's GeoJSON features. GeoJSON is published at `medium` and `low` only; `full` and `high` answer 422.",
		},
	],
	operationId: "joinRowsToBoundaryRelease",
	"x-rate-limit-cost": 10,
	tags: ["Geography"],
	summary:
		"Join your own rows of codes or names and values to a boundary release",
	description:
		'Send a column of area codes or names with a value each, and get the values back numbered as this release\'s tiles and downloads number their features, ready to draw on its map resource. Nothing is stored: the request carries the data, and the answer is never cached.\n\nSend JSON, `{"rows": [{"area": "E05000650", "value": 12.5}]}`, where the area may also be given as `code` or `name` and a row may carry a `parent` to settle a shared name, or CSV with a header naming the area column `area`, `code` or `name`, a `value` column and optionally a `parent` column. A CSV cell reading as a number is a number, and an empty one is null; any other value, JSON included, is passed through as sent. At most 250,000 rows in an 8 MiB body.\n\nEach row is read as `areas:validate` reads it. A code must be in this release, and a name must mean exactly one of its areas. A row that does not is listed in `unjoined` with its reason and the validator\'s full result: a superseded code says which releases hold it, and an ambiguous name lists its candidates. Two rows naming the same area leave that area out, both listed as `duplicate-area`, because which value was meant is the caller\'s to say. `values` holds one row per joined area, as `id`, `code`, `name` and `value`, where `id` is the integer the tiles carry, so a renderer sets feature state by it.\n\nWith `format=geojson` the joined areas come back as a GeoJSON FeatureCollection at the requested `tier`, each feature\'s properties carrying its `value`, with the release\'s attribution and the join summary beside the features. A tier whose GeoJSON exceeds 64 MB is refused with 422, since the join table and the tiles draw the same map without parsing a whole release per request.\n',
	requestBody: {
		required: true,
		content: {
			"application/json": {
				schema: {
					type: "object",
					required: ["rows"],
					properties: {
						rows: {
							type: "array",
							items: {
								type: "object",
								properties: {
									area: {
										type: "string",
									},
									code: {
										type: "string",
									},
									name: {
										type: "string",
									},
									value: {
										oneOf: [
											{
												type: "number",
											},
											{
												type: "string",
											},
											{
												type: "boolean",
											},
											{
												type: "null",
											},
										],
									},
									parent: {
										type: "string",
									},
								},
							},
						},
					},
				},
				example: {
					rows: [
						{
							area: "E05000650",
							value: 12.5,
						},
						{
							area: "Bristol Central",
							value: 8,
						},
					],
				},
			},
			"text/csv": {
				schema: {
					type: "string",
				},
				example: "code,value\nE05000650,12.5\nE05000651,8\n",
			},
		},
	},
	responses: {
		"200": {
			description:
				"The joined values, numbered as the release's tiles, the rows that did not join and why, a summary, and links to the release's map resource and tiles. With `format=geojson`, a GeoJSON FeatureCollection of the joined areas.\n",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
				},
				"application/geo+json": {
					schema: {
						type: "object",
					},
				},
			},
		},
		"400": {
			description:
				"The query is malformed, or the body cannot be read as rows with values.",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"405": {
			description:
				"The join was asked for with GET; it reads its rows from a POST body.",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"413": {
			description:
				"The body is larger than 8 MiB, or holds more than 250,000 rows.",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"415": {
			description:
				"The body is declared as neither JSON nor CSV. A body sent as form-urlencoded, as curl does by default, or with no type is read as JSON when it opens with { or [, and as CSV otherwise.",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"422": {
			description:
				"The requested GeoJSON tier is too large to read for one request, or is not published as GeoJSON (`full` and `high`).",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
