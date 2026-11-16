export const analysisPlanMetadata = {
	parameters: [
		{
			name: "measure",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"A measure id from `GET /v1/measures`, or one of its aliases, with optional dimension filters such as `offence=burglary`. An old series id returns a 404 naming the measure and members that replace it.\n",
		},
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/MeasureDataset",
		},
		{
			name: "period",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
		},
		{
			name: "to",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
		},
		{
			name: "geography",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
		},
		{
			name: "codeYear",
			in: "query",
			required: true,
			schema: {
				type: "integer",
			},
		},
	],
	operationId: "planAnalysis",
	tags: ["Trend"],
	summary: "Preflight a reviewed source-to-analysis conversion",
	"x-likely-refusal": {
		status: 400,
		when: "The source partition is not explicit. The route does not choose between a measure's sources.",
		"x-example-request":
			"/v1/analysis:plan?measure=road-collisions&period=2025&to=localAuthority/2023-05-uk-bgc-v2&geography=lsoa",
	},
	description:
		"Returns a plan only: the selected source partition, the published crosswalk and whether the requested period is comparable on the named analysis frame. It also states the measure's aggregation rule, country-by-country coverage and expected output size, and carries the ranked conversion-plan evidence where that catalogue is available. `saferAlternatives` always includes the source-exact route, so a caller can keep the publisher's partition when conversion is unnecessary. It does not fetch or transform observations.\n",
	responses: {
		"200": {
			description: "An available or not-comparable analysis plan.",
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
