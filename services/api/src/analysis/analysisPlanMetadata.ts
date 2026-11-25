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
		"Returns the selected source partition, the reviewed crosswalk or path, and whether the requested period is comparable on the named analysis frame. For comparable periods, country-by-country coverage and expected output size describe the selected source, period and conversion. The plan can also include the aggregation rule, ranked conversion evidence and a source-exact alternative. The result link serves the converted observations.\n",
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
