export const datasetMetadata = {
	operationId: "getDataset",
	tags: ["Data catalogue"],
	summary: "Get one published source dataset and its input hashes",
	"x-likely-refusal": {
		status: 404,
		when: "The id is a measure's, not a dataset's. A dataset is a publisher's source; `/v1/measures/{measure-id}` names the datasets behind a measure.",
		"x-example-request": "/v1/datasets/house-price-median",
	},
	parameters: [
		{
			name: "dataset-id",
			in: "path",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"A dataset id from `GET /v1/datasets`, such as `population-uk`.\n",
		},
	],
	responses: {
		"200": {
			description: "Dataset metadata and source lineage.",
			content: {
				"application/json": {
					"x-example-request": "/v1/datasets/population-uk",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							id: "population-uk",
							label: "Population (Local Authority)",
							publisher: "Office for National Statistics",
							sourceUrl:
								"https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland",
							temporalCoverage: "2011-2024",
							licence: {
								name: "Open Government Licence v3.0",
								url: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
							},
							description:
								"UK local authority population estimates by single year of age and sex, mid-2011 to mid-2024.",
							inputs: [
								{
									kind: "xlsxSheet",
									path: "demographics/population/mid-year-estimates/uk/myebtablesuk20112024.xlsx#MYEB1",
									bytes: 5951518,
									sha256: "aec8a5343f3f71ee062cc5b0e3f137087f89e1a1ccd0725cc6ffd2c77ba5d0f1",
								},
							],
							summary: {
								datasetCount: 14,
								dataRecordCount: 5054,
								codeYears: [2023],
							},
							compiled: {
								bytes: 13350128,
								sha256: "9b65e2c5703ac54675cde58ecb4367e23abe4ef09c6bfc9902b8d13ba0f97a11",
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
