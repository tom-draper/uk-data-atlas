import { taxonomyParameters } from "./taxonomyParameters";

export const measuresMetadata = {
	operationId: "listMeasures",
	tags: ["Data catalogue"],
	summary: "List measures currently available to query",
	description:
		"A measure is the thing measured, such as `population`, `recorded-crimes` or `party-vote-share`. Its breakdowns are `dimensions`, each with the members it is published for, such as `offence` with `burglary`; a member's `parent` is the member it is part of, and `total` names the member every other is part of, which a request that leaves the dimension out is given. Ask for a breakdown with a dimension filter on the data routes: `GET /v1/data/recorded-crimes/value?place=Leeds&offence=burglary`. Geography and period are never part of a measure id; they are `geography`, `codeYear` and `period`.\n\n`series` lists each combination of members published, with the request that reads it and its sources. `sources`, `aggregation`, `unit` and `links` stay at the top level for the measure as a whole.\n\nEach measure retains its source-facing `unit` label and adds an API-owned `unitDefinition`. `unitDefinition.code` is the canonical unit, `scaleToCanonical` multiplies a published numeric value into that unit, and `per` names an explicit denominator when one is published. This is descriptive metadata only: observation values and source artifacts are not rewritten.\n\n`q` searches by the words people use: `population`, `house prices`, `burglary`, `Labour vote share`. Every measure whose id, alias, label, dataset title or members hold all of the query's words is listed, best first: an exact id or alias, then a match in the label, then in the label and one member's, then in the id, then anywhere. A match that rests on members lists them in `matchedMembers`, each with the request that filters on it. A search never chooses one measure for the caller, and matching nothing is an empty list rather than a refusal. A measure's `aliases`, where it has any, are other names each naming it alone, accepted wherever its id is.\n\nEach measure carries the `theme` and `topic` of the dataset it is published in and the `module` that dataset is downloaded in. `theme`, `topic` and `module` filter the list, alone or with `q`: `GET /v1/measures?topic=population-estimates`. A value the registry does not hold is refused with the values it does.\n",
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
		...taxonomyParameters,
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
								theme: "population",
								topic: "population-estimates",
								module: "population",
								id: "population",
								label: "Population",
								description: "Mid-year population estimate.",
								valueKind: "count",
								unit: "people",
								unitDefinition: {
									code: "1",
									scaleToCanonical: 1,
								},
								aliases: [
									"population-estimate",
									"population-estimates",
								],
								aggregation: {
									kind: "extensive",
									operation: "sum",
									available: true,
								},
								dimensions: [],
								series: [
									{
										dimensions: {},
										label: "Population estimate",
										href: "/v1/data/population",
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
													countries: [
														"GB-ENG",
														"GB-WLS",
													],
													recordCount: 7608,
													note: "Published source records are available for England and Wales only; this endpoint does not infer Scottish or Northern Irish values.",
												},
											},
										],
									},
								],
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
											countries: ["GB-ENG", "GB-WLS"],
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
