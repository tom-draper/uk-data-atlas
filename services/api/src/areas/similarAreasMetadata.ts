export const similarAreasMetadata = {
	operationId: "findSimilarAreas",
	tags: ["Trend"],
	summary: "Find areas most similar across selected measures",
	description:
		"Loads each selected measure's source-exact partition for the requested geography and period. All partitions must use the same boundary year. `zscore-euclidean` standardises every measure by its all-area mean and population standard deviation before calculating Euclidean distance. `rank-euclidean` uses average ranks, which is less sensitive to skewed values. Areas missing any selected value are excluded. The dropped count covers areas present in at least one selected partition.",
	parameters: [
		{
			name: "geography",
			in: "path",
			required: true,
			schema: { type: "string" },
			description:
				"The source geography shared by every selected measure.",
		},
		{
			name: "code",
			in: "path",
			required: true,
			schema: { type: "string" },
			description: "The target area's source code.",
		},
		{
			name: "measures",
			in: "query",
			required: true,
			schema: { type: "string" },
			description: "One to ten comma-separated measure ids.",
		},
		{
			name: "period",
			in: "query",
			required: true,
			schema: { type: "string" },
			description: "A period served by every selected measure.",
		},
		{
			name: "limit",
			in: "query",
			schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
		},
		{
			name: "method",
			in: "query",
			schema: {
				type: "string",
				enum: ["zscore-euclidean", "rank-euclidean"],
				default: "zscore-euclidean",
			},
		},
	],
	"x-likely-refusal": {
		status: 400,
		when: "A selected measure does not serve the geography and period, or more than ten measures are requested.",
		"x-example-request":
			"/v1/areas/localAuthority/E08000010/similar?measures=population,population-density,total-jobs,imd-rank,life-expectancy,unemployment,house-price,broadband-availability,recorded-crimes,ghg-emissions,claimants&period=2024",
	},
	responses: {
		"200": {
			description:
				"The selected method, its scaling statistics and the nearest areas in deterministic order.",
			content: {
				"application/json": {
					"x-example-request":
						"/v1/areas/localAuthority/E08000010/similar?measures=population,population-density,total-jobs&period=2024",
					example: {
						apiVersion: "v1",
						atlasRelease: "sha256:example",
						data: {
							target: {
								geography: "localAuthority",
								code: "E08000010",
							},
							method: "zscore-euclidean",
							measures: [
								{
									id: "population",
									period: "2024",
									sourceGeography: {
										type: "localAuthority",
										codeYear: 2023,
									},
									mean: 173060,
									standardDeviation: 96004.4,
								},
							],
							droppedAreaCount: 0,
							areas: [
								{
									areaCode: "E08000015",
									distance: 0.44,
									rank: 1,
									values: { population: 160128 },
								},
							],
						},
						meta: { nextCursor: null },
					},
				},
			},
		},
		"400": { $ref: "#/components/responses/InvalidQuery" },
		"404": { $ref: "#/components/responses/NotFound" },
		"422": {
			description:
				"A selected measure is categorical, the target is missing a selected value, or the partitions use different boundary years.",
			content: {
				"application/problem+json": {
					schema: { $ref: "#/components/schemas/Problem" },
				},
			},
		},
		"503": { $ref: "#/components/responses/CatalogueUnavailable" },
	},
} as const;
