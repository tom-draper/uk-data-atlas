export const exportsMetadata = {
	operationId: "listBulkExports",
	tags: ["Sync"],
	summary: "List release-pinned whole observation artifacts",
	"x-likely-refusal": {
		status: 503,
		when: "Takes no input. Refused only when the server was started without the export manifest built.",
	},
	description:
		"Returns immutable JSON downloads for each published measure-source partition, under the Atlas release that pins the manifest. Every entry names the artifact, its content hash and byte size, and describes it as read from the artifact at build time: its record counts, layout, record fields and the datasets to attribute. Field meanings and dataset attribution are listed once in `fields` and `datasets`. Optional `formats` lists prebuilt CSV and Parquet files of the named measure, with the byte size, content hash and download link for each format.\n",
	responses: {
		"200": {
			description: "The bulk-export manifest.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/ExportManifestEnvelope",
					},
					"x-example-request": "/v1/exports",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:dfa67bf7df94ff5b655985b008aec8f28e235746fe0a15f4ca4853d172621eff",
						data: {
							schemaVersion: 1,
							dataCatalogHash:
								"sha256:708f04397ddcc766ca53f31c43fa806b3e77d9698502932c7dcc19816e200ec4",
							fields: {
								areaCode:
									"The official code of the area in the served source partition.",
								value: "The numeric value, in the measure's unit.",
								status: "`observed` for a value the publisher reported, `derived` for one this API computed.",
							},
							datasets: {
								"land-area": {
									publisher: "Office for National Statistics",
									sourceUrl:
										"https://geoportal.statistics.gov.uk/datasets/standard-area-measurements-for-the-local-authority-districts-december-2024-in-the-uk",
									licence: {
										name: "Open Government Licence v3.0",
										url: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
									},
									inputs: [
										{
											path: "core/land-area/sam-lad-2024-12.csv",
											sha256: "a507a632fd3dc616f88e1be9a3af9c22ec26f55d35f0969233abd358bea8c59e",
										},
									],
									href: "/v1/datasets/land-area",
								},
							},
							exports: [
								{
									id: "population-density-observations",
									measureId: "population-density",
									datasetId: "population-uk",
									periods: [
										"2011",
										"2012",
										"2013",
										"2014",
										"2015",
										"2016",
										"2017",
										"2018",
										"2019",
										"2020",
										"2021",
										"2022",
										"2023",
										"2024",
									],
									sourceGeography: {
										type: "localAuthority",
										codeYear: 2023,
									},
									format: "json",
									artifact: "population-density-observations",
									contentHash:
										"sha256:1569578cb3bf9272e9e1e9e9dfe79854c2e792d46d35bb85caa0a51fe440e451",
									bytes: 356302,
									href: "/v1/exports/population-density-observations",
									recordCount: 5054,
									recordCountByPeriod: {
										"2011": 361,
										"2012": 361,
										"2013": 361,
										"2014": 361,
										"2015": 361,
										"2016": 361,
										"2017": 361,
										"2018": 361,
										"2019": 361,
										"2020": 361,
										"2021": 361,
										"2022": 361,
										"2023": 361,
										"2024": 361,
									},
									schema: {
										version: 1,
										layout: "periods",
										recordType: "numeric",
										fields: [
											{
												name: "areaCode",
												type: "string",
												required: true,
											},
											{
												name: "value",
												type: "number",
												required: true,
											},
											{
												name: "status",
												type: "string",
												required: true,
											},
										],
									},
									provenance: {
										measure:
											"/v1/measures/population-density",
										datasets: [
											{
												id: "population-uk",
												role: "source",
											},
											{
												id: "land-area",
												role: "derived-from",
											},
										],
									},
								},
							],
							note: "Each export is the immutable publisher-observation JSON artifact used by the API. Reviewed served corrections, if any, are recorded separately and retain the publisher code on the affected record.",
						},
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
