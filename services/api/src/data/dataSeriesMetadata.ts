export const dataSeriesMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/MeasureId",
		},
		{
			$ref: "#/components/parameters/Place",
		},
		{
			$ref: "#/components/parameters/PlaceSourceGeography",
		},
		{
			$ref: "#/components/parameters/OptionalSourceCodeYear",
		},
		{
			name: "to",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"One `geography/release` pair for a reviewed analysis frame. The source geography and boundary year select a particular partition; omit them to use the current one for `place`.\n",
		},
		{
			name: "datasetId",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Narrows the partition to one dataset where a measure has several on the same geography and vintage.\n",
		},
	],
	operationId: "getSourceExactMeasureSeries",
	"x-refused-query-parameters": ["release", "conversion", "aggregate"],
	tags: ["Trend"],
	summary: "Retrieve a source-exact or reviewed derived time series",
	"x-likely-refusal": {
		status: 409,
		code: "ambiguous_place",
		when: "The name means more than one area the measure is published for. Each choice carries the request that asks about it alone.",
		"x-example-request": "/v1/data/population/series?place=Newport",
	},
	description:
		"A measure with dimensions answers for the members its filters name, such as `?offence=burglary`; a dimension left out takes its total where one is published, and several members or `*` answer one `breakdown` entry per series, as `/value` does.\n\nReturns all published observations for one area code within one source geography and code vintage. `place` accepts an area name, code or reference. With no source partition, the current published partition for that place is selected and returned as `defaults`. Without `to`, the result is source-exact: it does not select a boundary release, convert values or aggregate them. With `to`, the result is available only where the exact source partition has a reviewed conversion; every returned value is then labelled `derived` on that named frame. Supply `datasetId` when a measure has more than one source for the requested geography and boundary year.\n",
	responses: {
		"200": {
			description:
				"Source-exact or reviewed derived observations in ascending source period order.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request":
						"/v1/data/population/series?place=E08000025&geography=localAuthority&codeYear=2023",
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
								datasetId: "population-uk",
								periods: ["2011"],
								sourceGeography: {
									type: "localAuthority",
									codeYear: 2023,
								},
								coverage: {
									kind: "source-reported",
									countries: ["GB-ENG"],
									recordCount: 361,
									note: "Published source records cover all four UK nations for every available period. Historic values remain keyed to the source's 2023 local-authority code vintage.",
								},
							},
							areaCode: "E08000025",
							sourceGeography: {
								type: "localAuthority",
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
										type: "localAuthority",
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
										id: "population-uk",
										href: "/v1/datasets/population-uk",
									},
									observations: {
										artifact:
											"population-local-authority-observations",
										contentHash:
											"sha256:1bf9e38cc9c37b37492b4a3cdc6b28c28ddeb5c2adc81e838ef947d78a0c0a9b",
										periods: ["2011"],
									},
								},
							},
							series: [
								{
									period: "2011",
									areaCode: "E08000025",
									value: 1074283,
									status: "observed",
								},
							],
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
