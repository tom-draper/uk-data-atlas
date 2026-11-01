export const boundaryReleaseMetadata = {
	operationId: "getBoundaryRelease",
	tags: ["Geography"],
	summary: "Get one boundary release, with links to download it whole",
	"x-likely-refusal": {
		status: 404,
		code: "unknown_release",
		when: "The release is named by a date alone. A release id also names its coverage and product, such as `2024-12-uk-bgc`; `/v1/boundary-releases` lists them.",
		"x-example-request": "/v1/boundary-releases/ward/2024-12",
	},
	parameters: [
		{
			$ref: "#/components/parameters/Geography",
		},
		{
			$ref: "#/components/parameters/Release",
		},
	],
	responses: {
		"200": {
			description: "The matching boundary release.",
			headers: {
				Deprecation: {
					$ref: "#/components/headers/ReleaseDeprecation",
				},
				Sunset: {
					$ref: "#/components/headers/ReleaseSunset",
				},
				Link: {
					$ref: "#/components/headers/ReleaseSuccessorLink",
				},
			},
			content: {
				"application/json": {
					"x-example-request":
						"/v1/boundary-releases/constituency/2024-07-uk-bgc",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:9edc254c5d4cd0a90fc5d3b2544e5f64946d6d0e6a8b68860e3aa6f0ac8d0912",
						data: {
							id: "2024-07-uk-bgc",
							geography: "constituency",
							title: "Westminster parliamentary constituencies, July 2024 (United Kingdom, generalised, clipped)",
							description:
								"Westminster parliamentary constituencies as published for July 2024, covering the United Kingdom. Generalised to 20 m and clipped to the coastline.",
							temporalCoverage: "2024",
							coverage: {
								countries: [
									"GB-ENG",
									"GB-NIR",
									"GB-SCT",
									"GB-WLS",
								],
							},
							source: {
								publisher: "Office for National Statistics",
								url: "https://geoportal.statistics.gov.uk/",
								licence: {
									name: "Open Government Licence v3.0",
									url: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
								},
							},
							metadataHash:
								"sha256:cb36a990db1b57ae973ebe88874fae7f560a12721fa784cf5e52a9fd5e8466f3",

							documents: {
								validation:
									"/v1/documents/validation-report.json",
								health: "/v1/documents/geography-health.json",
							},
							downloads: {
								status: "available",
								mapResource:
									"/v1/map-resources/constituency/2024-07-uk-bgc",
								pmtiles:
									"/v1/map-resources/constituency/2024-07-uk-bgc.pmtiles",
								tileJson:
									"/v1/map-resources/constituency/2024-07-uk-bgc/tiles.json",
								geojson: {
									medium: "/v1/map-resources/constituency/2024-07-uk-bgc/features?tier=medium&format=geojson",
									low: "/v1/map-resources/constituency/2024-07-uk-bgc/features?tier=low&format=geojson",
								},
								geoparquet: {
									full: "/v1/map-resources/constituency/2024-07-uk-bgc/features?tier=full",
									high: "/v1/map-resources/constituency/2024-07-uk-bgc/features?tier=high",
									medium: "/v1/map-resources/constituency/2024-07-uk-bgc/features?tier=medium",
									low: "/v1/map-resources/constituency/2024-07-uk-bgc/features?tier=low",
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
		"404": {
			$ref: "#/components/responses/NotFound",
		},
	},
} as const;
