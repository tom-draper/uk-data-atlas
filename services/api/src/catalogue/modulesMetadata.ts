export const modulesMetadata = {
	operationId: "listModules",
	tags: ["Data catalogue"],
	summary: "List the modules datasets are downloaded in",
	description:
		"A module is a download unit built from topics: one per theme, plus the foundation parts `core`, `boundaries` and `postcodes`, which hold no datasets of their own. Each lists the `themes` and `topics` it is built from and how many published datasets it holds. It does not describe the download itself. The ids are the `module` on `/v1/datasets` and `/v1/measures`, and the values its filter accepts.\n",
	"x-likely-refusal": {
		status: 503,
		when: "Refused only when the server was started without the data catalogue built, because the dataset counts come from it.",
	},
	responses: {
		"200": {
			description:
				"Modules in registry order: theme modules, then foundation parts.",
			content: {
				"application/json": {
					"x-example-request": "/v1/modules",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: [
							{
								id: "population",
								kind: "theme",
								label: "People and population",
								description:
									"How many people live where, and who they are.",
								themes: ["population"],
								topics: [
									{
										id: "population-estimates",
										label: "Population estimates",
										theme: "population",
									},
								],
								datasetCount: 8,
								links: {
									datasets: "/v1/datasets?module=population",
								},
							},
							{
								id: "core",
								kind: "foundation",
								label: "Core",
								description:
									"Areas, releases, crosswalks, lookups, named places, the catalogue of every module and denominators. Always included.",
								themes: [],
								topics: [],
								datasetCount: 0,
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
