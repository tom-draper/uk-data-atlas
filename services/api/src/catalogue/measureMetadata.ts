export const measureMetadata = {
	operationId: "getMeasure",
	tags: ["Data catalogue"],
	summary: "Get one measure's semantics and availability",
	"x-likely-refusal": {
		status: 404,
		when: "The measure id is guessed rather than listed, or names several measures. `deprivation` is four national indices, so it is no measure's id or alias; `/v1/measures?q=deprivation` lists them.",
		"x-example-request": "/v1/measures/deprivation",
	},
	description:
		"A measure's definition: what it counts, the unit, whether it may be summed or averaged, and which source partitions publish it with what national coverage.\n\n`unit` remains the published display label. `unitDefinition` supplies an API-owned canonical code, scale and (where applicable) denominator for safe unit-aware calculations; it never changes the source artifact or an observation value.\n\nWhere another nation publishes its own answer to the same question, the measure carries `concept` and `elsewhere`. Each entry in `elsewhere` names that measure, the countries it covers, and whether the two are `comparable`. For the four national deprivation indices they are not: each ranks its own nation's areas from 1 against its own domains and weights, so they cannot be put on one scale. The reason travels with the link rather than living in documentation, because the numbers themselves give no sign of it.\n",
	parameters: [
		{
			$ref: "#/components/parameters/MeasureId",
		},
	],
	responses: {
		"200": {
			description: "The measure definition.",
			content: {
				"application/json": {
					"x-example-request": "/v1/measures/population",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
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
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
