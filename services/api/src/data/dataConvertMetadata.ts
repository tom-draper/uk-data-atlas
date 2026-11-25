export const dataConvertMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/MeasureId",
		},
		{
			name: "crosswalk",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"A crosswalk id returned by `GET /crosswalks`, applied forward. Required unless `path` is named; naming both is refused.\n",
		},
		{
			name: "path",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"A relationship path id returned by `GET /relationships`, applied through every step. Required unless `crosswalk` is named; naming both is refused.\n",
		},
		{
			$ref: "#/components/parameters/SourcePeriod",
		},
		{
			$ref: "#/components/parameters/SourceGeography",
		},
		{
			$ref: "#/components/parameters/SourceCodeYear",
		},
		{
			$ref: "#/components/parameters/PageLimit",
		},
		{
			$ref: "#/components/parameters/PageCursor",
		},
	],
	operationId: "convertSourceExactMeasure",
	"x-refused-query-parameters": ["release"],
	tags: ["Trend"],
	summary:
		"Regroup an extensive measure through a published crosswalk or relationship path",
	"x-likely-refusal": {
		status: 400,
		when: "Neither `crosswalk` nor `path` is named. This route never chooses a conversion path; `/v1/relationships` finds the published ones.",
		"x-example-request":
			"/v1/data/population/convert?period=2022&geography=ward&codeYear=2023",
	},
	description:
		"Converts a source partition onto another geography or code vintage using the crosswalk, or the published relationship path, the caller names. Exactly one of `crosswalk` and `path` is required. The route never selects a conversion path: `GET /crosswalks` lists the published crosswalks and `GET /relationships` the published paths, and the response repeats each crosswalk's method, quality, weighting and content hash.\n\nA `path` carries values through every one of its steps in order, in the direction each step declares. Weights multiply along the path, so a source split at one step and split again at the next is apportioned by the product of the two published weights. A path is refused as a whole if any step would drop a value or split one without a weight.\n\nThe crosswalk decides the target areas, so this route selects no geometry release: passing `release` is refused rather than ignored. Ask `/data/{measure-id}` with a compatible `release` to join geometry to source-exact values instead.\nOnly a measure declared extensive may be converted, because conversion works by adding values up. An intensive measure is rejected: a share or a rank cannot be regrouped by summing, and weighting one by area produces a number with no meaning.\nThe reported `method` distinguishes the outcomes. Across a path it describes every step together: `exact` only if no step splits a source, and `population-weighted` only if every splitting step is. `exact` means every source area sits wholly within one target, so the conversion is a regrouping and the partition total is unchanged. `area-weighted` means some sources were split in proportion to overlapping area, which is an estimate that assumes the measure is spread evenly across each source. `population-weighted` means they were split by where each source's residents live, counted from the crosswalk's population building blocks, which assumes the measure follows resident population.\nA source code the crosswalk does not carry, or a split source with no published weight, is rejected rather than partially converted.\n",
	responses: {
		"200": {
			description:
				"Cursor-paginated derived values on the crosswalk's target areas, with the conversion method and the crosswalk's own provenance.\n",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request":
						"/v1/data/population/convert?period=2022&geography=ward&codeYear=2023&crosswalk=ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment&limit=1",
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
							targetGeography: {
								type: "localAuthority",
								boundaryRelease: "2023-05-uk-bgc-v2",
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
									status: "applied",
									note: "Input observations are source-exact; the values below were regrouped onto the crosswalk's target areas.",
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
							conversion: {
								crosswalk: {
									id: "ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment",
									href: "/v1/crosswalks/ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment",
									method: "clean-containment",
									quality: "publisher-supplied",
									weighting: {
										status: "not-applicable",
									},
									contentHash:
										"sha256:36a3e0270fa4a0f380c54bd692270fe029cbb1f1213b2e5e9c01d193969e2e7b",
								},
								method: "exact",
								inputRecordCount: 7608,
								outputRecordCount: 318,
								note: "Every source area sits wholly within one target, so this is a regrouping and the partition total is unchanged.",
							},
							aggregation: null,
							records: [
								{
									areaCode: "E06000001",
									value: 93861,
									status: "derived",
									inputAreaCount: 12,
								},
							],
						},
						meta: {
							nextCursor: "<opaque cursor>",
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
				"The measure is intensive, the crosswalk starts at another geography, or the partition cannot be converted completely.\n",
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
