export const measuresMetadata = {
	operationId: "listMeasures",
	tags: ["Data catalogue"],
	summary: "List measures currently available to query",
	description:
		"Each measure retains its source-facing `unit` label and adds an API-owned `unitDefinition`. `unitDefinition.code` is the canonical unit, `scaleToCanonical` multiplies a published numeric value into that unit, and `per` names an explicit denominator when one is published. For example, `£ million` is `GBP` with a scale of 1000000, and percent is `proportion` with a scale of 0.01. This is descriptive metadata only: observation values and source artifacts are not rewritten. `q` searches by the words people use: `population`, `house prices`, `deprivation`. Every measure whose id, alias, label or dataset title holds all of the query's words is listed, best first: an exact id or alias, then a match in the label, then in the id, then anywhere. A search never chooses one measure for the caller, and matching nothing is an empty list rather than a refusal. A measure's `aliases`, where it has any, are other names each naming it alone, accepted wherever its id is.\n",
	"x-likely-refusal": {
		status: 503,
		when: "Refused only when the server was started without the data catalogue built. A search that matches nothing is an empty list, not a refusal.",
	},
	parameters: [
		{
			name: "q",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Words to search measures by, such as `house prices`. Omit to list every measure.",
		},
	],
	responses: {
		"200": {
			description:
				"Measure definitions, coverage and supported operations.",
			content: {
				"application/json": {
					"x-example-request": "/v1/measures",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: [
							{
								id: "population",
								label: "Population estimate",
								valueKind: "count",
								unit: "people",
								unitDefinition: {
									code: "1",
									scaleToCanonical: 1,
								},
								aggregation: {
									kind: "extensive",
									operation: "sum",
									available: true,
								},
								sources: [
									{
										datasetId: "population",
										periods: ["2022"],
										sourceGeography: {
											type: "ward",
											codeYear: 2023,
										},
										coverage: {
											kind: "partial",
											countries: ["GB-ENG"],
											recordCount: 7608,
											note: "Published source records are available for England and Wales only; this endpoint does not infer Scottish or Northern Irish values.",
										},
									},
								],
								availability: {
									sourceExact: true,
									conversion: false,
									aggregation: true,
								},
								links: {
									data: "/v1/data/population",
								},
							},
						],
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
