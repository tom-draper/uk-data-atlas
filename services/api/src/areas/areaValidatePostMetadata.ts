export const areaValidatePostMetadata = {
	parameters: [
		{
			name: "geography",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"As on the GET. Supply with `release`, or omit both to infer a likely compiled release.",
		},
		{
			name: "release",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"As on the GET. Supply with `geography`, or omit both to infer a likely compiled release.",
		},
	],
	operationId: "validateAreaValuesPosted",
	"x-rate-limit-cost": 10,
	tags: ["Geography"],
	summary: "Validate a whole column of area codes or names sent as the body",
	description:
		'The same check as the GET, for a column longer than a URL holds: up to 250,000 values in an 8 MiB body. Send JSON, `{"values": ["E05000650", "Bristol"], "parents": [...]}` or `{"rows": [{"area": "Bristol", "parent": "..."}]}`, or CSV with a header row naming the column `area`, `code`, `name` or `value`, and optionally a `parent` column. `geography` and `release` stay in the query, as on the GET, and the answer is exactly the GET\'s for the same values. It is never cached, since it depends on the body.\n',
	requestBody: {
		required: true,
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						values: {
							type: "array",
							items: {
								type: "string",
							},
						},
						parents: {
							type: "array",
							items: {
								type: "string",
							},
						},
						rows: {
							type: "array",
							items: {
								type: "object",
								properties: {
									area: {
										type: "string",
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
					values: ["Bristol", "E07000026"],
				},
			},
			"text/csv": {
				schema: {
					type: "string",
				},
				example: "area\nBristol\nE07000026\n",
			},
		},
	},
	responses: {
		"200": {
			description:
				"A result for every value, in input order, and a summary, as the GET gives.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
				},
			},
		},
		"400": {
			description:
				"The body cannot be read as rows, or a parent is missing for some rows.",
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
	},
} as const;
