export const dataCompareMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/MeasureId",
		},
		{
			$ref: "#/components/parameters/OptionalSourcePeriod",
		},
		{
			$ref: "#/components/parameters/OptionalSourceGeography",
		},
		{
			$ref: "#/components/parameters/OptionalSourceCodeYear",
		},
		{
			name: "baselinePlace",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description: "The area the difference is measured from.",
		},
		{
			name: "comparisonPlace",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description: "The area the difference is measured to.",
		},
	],
	operationId: "compareSourceExactMeasureAreas",
	"x-refused-query-parameters": ["release", "conversion", "aggregate"],
	tags: ["Trend"],
	summary: "Compare two areas within one source-exact measure partition",
	"x-likely-refusal": {
		status: 400,
		when: "The two areas are of different geographies, so no one source partition holds both.",
		"x-example-request":
			"/v1/data/population/compare?baselinePlace=E05000932&comparisonPlace=W06000022",
	},
	description:
		"Returns the comparison observation minus the baseline observation for one published period, geography and code vintage. Area codes may be replaced by unambiguous place names. Omitting source selectors uses the current published partition and latest period, recorded in `defaults`. The two named areas must be in the same source partition. Ratios report a difference on their source scale rather than a misleading relative change. The route does not select a boundary release, convert values or aggregate them.\n",
	responses: {
		"200": {
			description:
				"The named source-exact observations and their directed difference.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request":
						"/v1/data/population/compare?period=2022&geography=ward&codeYear=2023&baselinePlace=E05000932&comparisonPlace=W05001039",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							measure: {
								id: "population",
								label: "Population",
								valueKind: "count",
								unit: "people",
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
							source: {
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
							period: "2022",
							sourceGeography: {
								type: "ward",
								codeYear: 2023,
							},
							provenance: {
								atlasRelease: {
									id: "sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
									href: "/v1/atlas-release",
								},
								measure: {
									id: "population",
									href: "/v1/measures/population",
								},
								geography: {
									source: {
										type: "ward",
										codeYear: 2023,
									},
									match: {
										status: "no-boundary-release-selected",
										note: "The published observations declare a geography type and code vintage, but not a boundary release.",
									},
								},
								transformation: {
									status: "not-applied",
									note: "Values are served source-exact; no geographic conversion or aggregation was applied.",
								},
								source: {
									dataset: {
										id: "population",
										href: "/v1/datasets/population",
									},
									observations: {
										artifact: "population-observations",
										contentHash:
											"sha256:af1de02a052ace448dfb92c80cc312118a16c30bc77bf7a8c4d0e24a24ddab18",
										period: "2022",
									},
								},
							},
							comparison: {
								baseline: {
									areaCode: "E05000932",
									value: 12676,
									status: "observed",
								},
								comparison: {
									areaCode: "W05001039",
									value: 3288,
									status: "observed",
								},
								difference: {
									direction: "comparison-minus-baseline",
									value: -9388,
									unit: "people",
									interpretation:
										"Difference in the source-published unit.",
								},
								relativeDifference: {
									value: -0.74061218049858,
									basis: "(comparison - baseline) / baseline",
								},
							},
						},
						meta: {
							nextCursor: null,
						},
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
		"409": {
			$ref: "#/components/responses/AmbiguousArea",
		},
		"422": {
			description:
				"The requested conversion, aggregation or geometry release is not supported.",
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
