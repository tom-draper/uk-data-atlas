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
		"A measure's definition: what it measures, the unit, whether it may be summed or averaged, its dimensions and their members, and the series and source partitions published for each combination of members, with national coverage.\n\n`unit` remains the published display label. `unitDefinition` supplies an API-owned canonical code, scale and (where applicable) denominator for safe unit-aware calculations; it never changes the source artifact or an observation value.\n\nWhere another nation publishes its own answer to the same question, the measure carries `concept` and `elsewhere`. Each entry in `elsewhere` names that measure, the countries it covers, and whether the two are `comparable`. For the four national deprivation indices they are not: each ranks its own nation's areas from 1 against its own domains and weights, so they cannot be put on one scale. The reason travels with the link rather than living in documentation, because the numbers themselves give no sign of it.\n",
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
					"x-example-request": "/v1/measures/recorded-crimes",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							theme: "society",
							topic: "crime-and-justice",
							module: "society",
							id: "recorded-crimes",
							label: "Police recorded crime",
							description: "Offences recorded by the police.",
							valueKind: "count",
							unit: "offences",
							unitDefinition: {
								code: "1",
								scaleToCanonical: 1,
							},
							aggregation: {
								kind: "extensive",
								operation: "sum",
								available: true,
							},
							dimensions: [
								{
									id: "offence",
									label: "Offence group",
									total: "total",
									members: [
										{
											code: "total",
											label: "All recorded crime",
										},
										{
											code: "theft",
											label: "Theft offences",
											parent: "total",
										},
										{
											code: "burglary",
											label: "Burglary",
											parent: "theft",
										},
									],
								},
							],
							series: [
								{
									dimensions: {
										offence: "burglary",
									},
									label: "Burglary",
									href: "/v1/data/recorded-crimes?offence=burglary",
									sources: [
										{
											datasetId: "crime",
											periods: ["year-ending-2026-03"],
											sourceGeography: {
												type: "communitySafetyPartnership",
												codeYear: 2023,
											},
											coverage: {
												kind: "source-reported",
												countries: ["GB-ENG", "GB-WLS"],
												recordCount: 309,
												note: "Published source records cover every community safety partnership in England and Wales except those whose crime the police recorded as unassigned, which are not served.",
											},
										},
									],
								},
							],
							sources: [
								{
									datasetId: "crime",
									periods: ["year-ending-2026-03"],
									sourceGeography: {
										type: "communitySafetyPartnership",
										codeYear: 2023,
									},
									coverage: {
										kind: "source-reported",
										countries: ["GB-ENG", "GB-WLS"],
										recordCount: 309,
										note: "Published source records cover every community safety partnership in England and Wales except those whose crime the police recorded as unassigned, which are not served.",
									},
								},
							],
							availability: {
								sourceExact: true,
								conversion: false,
								aggregation: true,
							},
							links: {
								data: "/v1/data/recorded-crimes",
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
