export const dataRankingsMetadata = {
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
			name: "order",
			in: "query",
			required: false,
			schema: {
				enum: ["asc", "desc"],
				default: "desc",
			},
			description: "Whether the highest or the lowest value ranks first.",
		},
		{
			$ref: "#/components/parameters/PageLimit",
		},
		{
			$ref: "#/components/parameters/PageCursor",
		},
	],
	operationId: "getSourceExactMeasureRankings",
	"x-refused-query-parameters": ["release", "conversion", "aggregate"],
	tags: ["Trend"],
	summary: "Rank areas within one source-exact measure partition",
	"x-likely-refusal": {
		status: 400,
		when: "The measure is published on several geographies and none is named, so there is no one set of areas to rank.",
		"x-example-request": "/v1/data/population/rankings",
	},
	description:
		"Ranks only the observations published for one period, geography and code vintage. Omitting any of those selects the current published partition and latest period, recorded in `defaults`. Uses competition ranking: tied values share a rank and the following rank accounts for all preceding observations (1, 1, 3). It does not select a boundary release, convert values or aggregate them.\n",
	responses: {
		"200": {
			description:
				"Cursor-paginated competition ranks for the source partition.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request":
						"/v1/data/population/rankings?period=2022&geography=ward&codeYear=2023&limit=1",
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
							ranking: {
								order: "desc",
								method: "competition",
								note: "Equal values share a rank; the following rank accounts for every preceding observation (for example 1, 1, 3).",
							},
							records: [
								{
									areaCode: "E05011403",
									value: 34637,
									status: "observed",
									rank: 1,
									tieCount: 1,
								},
							],
						},
						meta: {
							nextCursor: "RTA1MDExNDAz",
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
