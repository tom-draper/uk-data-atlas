export const themesMetadata = {
	operationId: "listThemes",
	tags: ["Data catalogue"],
	summary: "List the themes and topics datasets are filed under",
	description:
		"Datasets are filed under a topic, and topics under a theme, in the order the docs use. Each theme lists its topics, the `modules` it is downloaded in and how many published datasets it holds. `links.datasets` is the listing filtered to it: `GET /v1/datasets?theme=population`. The ids are the `theme` and `topic` on `/v1/datasets` and `/v1/measures`, and the values their filters accept.\n",
	"x-likely-refusal": {
		status: 503,
		when: "Refused only when the server was started without the data catalogue built, because the dataset counts come from it.",
	},
	responses: {
		"200": {
			description: "Themes in registry order, each with its topics.",
			content: {
				"application/json": {
					"x-example-request": "/v1/themes",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: [
							{
								id: "population",
								label: "People and population",
								description:
									"How many people live where, and who they are.",
								modules: ["population"],
								datasetCount: 8,
								links: {
									datasets: "/v1/datasets?theme=population",
								},
								topics: [
									{
										id: "population-estimates",
										label: "Population estimates",
										description:
											"How many people live in each area, by age and sex.",
										module: "population",
										datasetCount: 6,
										links: {
											datasets:
												"/v1/datasets?topic=population-estimates",
										},
									},
								],
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
