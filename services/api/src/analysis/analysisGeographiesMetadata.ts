export const analysisGeographiesMetadata = {
	parameters: [
		{
			name: "measure",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"A measure id from `GET /v1/measures`, or one of its aliases, with optional dimension filters such as `offence=burglary`. An old series id such as `crime-burglary` returns a 404 naming the measure and members that replace it.\n",
		},
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/MeasureDataset",
		},
	],
	operationId: "listAnalysisGeographies",
	tags: ["Trend"],
	summary: "List reviewed analysis geography conversions",
	"x-likely-refusal": {
		status: 503,
		when: "Takes no required input; an unknown `measure` filter returns an empty list.",
	},
	description:
		"Lists the measure/source/frame conversions that the Atlas has reviewed as safe to perform. A published crosswalk alone is not sufficient. A reviewed conversion is one crosswalk, or a published relationship path whose `conversion.method` is `relationship-path` and whose `conversion.steps` list each crosswalk and direction it runs through.\n",
	responses: {
		"200": {
			description: "Reviewed analysis geography support.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/AnalysisGeographyListEnvelope",
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
