export const crosswalkConvertMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/CrosswalkId",
		},
		{
			name: "semantics",
			in: "query",
			required: true,
			schema: {
				type: "string",
				enum: ["count"],
			},
			description: "Assert that values are non-negative additive counts.",
		},
		{
			name: "weighting",
			in: "query",
			schema: {
				type: "string",
				enum: ["area", "population"],
			},
			description:
				"Opt in to this crosswalk's area or population weights for splits.",
		},
	],
	operationId: "convertSuppliedCounts",
	"x-rate-limit-cost": 10,
	tags: ["Geography"],
	summary: "Convert your own counts through a named crosswalk",
	description:
		"Send JSON rows or CSV with a code, area or name column and a numeric value column. An optional parent column disambiguates names. At most 250,000 rows in an 8 MiB body. Nothing is stored or cached.\nThe crosswalk fixes the exact source and target releases. Its source identities must be compiled. semantics=count asserts that the values are finite, non-negative counts that add over areas. Fractions are allowed. A missing, invalid, ambiguous, duplicate or non-numeric row refuses the entire request with 422. Code and name rows resolving to the same area are duplicates. The first 1,000 rejected rows are listed, with rejectedCount giving their full count.\nOmit weighting for exact regrouping. Splits require weighting=area or weighting=population matching the published crosswalk. An unweighted split or unmapped source refuses the entire request. Best-fit mappings cannot convert counts. Weighted results are estimates, with no rounding.\nEach output states whether every source this crosswalk maps to it was supplied. Complete coverage is relative to published crosswalk mappings, not the whole geography. Unreached targets are absent, never zero. The response pins the Atlas release, input text hash and crosswalk hash, and reports input and output totals. Send a UTF-8 body to reproduce its hash.\n",
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
							minItems: 1,
							maxItems: 250000,
							items: {
								type: "object",
								required: ["value"],
								properties: {
									code: {
										type: "string",
									},
									area: {
										type: "string",
									},
									name: {
										type: "string",
									},
									parent: {
										type: "string",
									},
									value: {
										type: "number",
										minimum: 0,
									},
								},
							},
						},
					},
				},
				example: {
					rows: [
						{
							code: "E05000650",
							value: 12,
						},
					],
				},
			},
			"text/csv": {
				schema: {
					type: "string",
				},
				example: "code,value\nE05000650,12\n",
			},
		},
	},
	responses: {
		"200": {
			description:
				"Converted counts and coverage against the named crosswalk.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/SuppliedCountConversionEnvelope",
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
		"405": {
			description: "This operation accepts POST only.",
		},
		"413": {
			description: "The request exceeds 8 MiB or 250,000 rows.",
		},
		"415": {
			description: "Send application/json or text/csv.",
		},
		"422": {
			description:
				"No conversion was applied. Correct rejected rows or select supported weighting.",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/ConversionNotAvailableProblem",
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
