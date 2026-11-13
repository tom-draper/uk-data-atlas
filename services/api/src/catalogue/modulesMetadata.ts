export const modulesMetadata = {
	operationId: "listModules",
	tags: ["Data catalogue"],
	summary: "List the modules datasets are downloaded in",
	description:
		"A module is a download unit built from datasets: one per theme, a few split-out modules such as `population-detail` and `politics-sharealike`, plus the foundation parts `core`, `boundaries` and `postcodes`, which hold no datasets of their own. A module with `requires` is an add-on: `politics-sharealike` holds only the share-alike rows of a dataset that stays in `politics` (those datasets are marked `partial`), so it is downloaded with the module it requires, and the module it adds to lists it under `addOns`. Each lists the `themes` and `topics` it is built from and how many published datasets it holds. The manifest fields are the ones written beside each module in the data download: the licences its datasets use, a `licenceConflict` when it mixes share-alike data with other licences, the core `compatibility` key, the manifest `schemaVersion` and a `build` block whose size and files are null until the module database is built. `licences` is null for a foundation part whose licences are not derived. The ids are the `module` on `/v1/datasets` and `/v1/measures`, and the values its filter accepts.\n",
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
										description:
											"How many people live in each area, by age and sex.",
									},
								],
								datasetCount: 8,
								links: {
									datasets: "/v1/datasets?module=population",
								},
								schemaVersion: 1,
								alwaysIncluded: false,
								requires: [],
								addOns: [],
								compatibility: { core: "atlas-core-1" },
								licences: [
									{
										id: "ogl-3.0",
										name: "Open Government Licence v3.0",
										url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
										commercialUse: true,
										shareAlike: false,
									},
								],
								licenceConflict: null,
								datasets: [
									{
										id: "population",
										title: "Population Estimates",
										topic: "population-estimates",
										partial: false,
									},
								],
								build: {
									status: "not-built",
									bytes: null,
									files: null,
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
								schemaVersion: 1,
								alwaysIncluded: true,
								compatibility: { core: "atlas-core-1" },
								licences: null,
								licenceConflict: null,
								datasets: [],
								build: {
									status: "not-built",
									bytes: null,
									files: null,
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
