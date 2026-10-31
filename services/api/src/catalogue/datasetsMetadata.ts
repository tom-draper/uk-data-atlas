export const datasetsMetadata = {
	operationId: "listDatasets",
	tags: ["Data catalogue"],
	summary: "List published source datasets and their lineage",
	"x-likely-refusal": {
		status: 503,
		when: "Takes no input. Refused only when the server was started without the data catalogue built.",
	},
	responses: {
		"200": {
			description:
				"Dataset metadata compiled from the repository dataset manifest.",
			content: {
				"application/json": {
					"x-example-request": "/v1/datasets",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: [
							{
								id: "air-quality",
								label: "Air Quality",
								publisher:
									"Department for Environment, Food and Rural Affairs",
								sourceUrl:
									"https://uk-air.defra.gov.uk/data/pcm-data",
								temporalCoverage: "2024",
								licence: {
									name: "Open Government Licence v3.0",
									url: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
								},
								description:
									"Modelled 2024 annual mean background NO2, PM10 and PM2.5 by local authority, averaged from Defra's 1x1 km PCM maps, with Defra's population-weighted PM2.5.",
								inputs: [
									{
										kind: "text",
										path: "environment/air-quality/pcm-background-by-local-authority-2024.csv",
										bytes: 16025,
										sha256: "433a690b5d67b88e86543c0e4696a87239f34a1afa5d024956bb0eb285d24e31",
									},
								],
								summary: {
									datasetCount: 1,
									dataRecordCount: 361,
									codeYears: [2024],
								},
								compiled: {
									bytes: 72571,
									sha256: "8520b94c71e1e6f1a2d1209fddeae30ea4e8c79487eef04d3402454ee85126db",
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
