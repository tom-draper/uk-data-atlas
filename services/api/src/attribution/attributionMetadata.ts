export const attributionMetadata = {
	parameters: [
		{
			name: "dataset",
			in: "query",
			required: false,
			schema: {
				type: "array",
				items: {
					type: "string",
				},
			},
			description: "A dataset id from `GET /datasets`. Repeatable.",
		},
		{
			name: "measure",
			in: "query",
			required: false,
			schema: {
				type: "array",
				items: {
					type: "string",
				},
			},
			description:
				"A measure id from `GET /v1/measures`, or one of its aliases. Repeatable. Dimension filters such as `offence=burglary` apply to each listed measure that has the dimension; an old series id such as `crime-burglary` returns a 404 naming the measure and members that replace it.\n",
		},
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/MeasureDataset",
		},
		{
			name: "boundaryRelease",
			in: "query",
			required: false,
			schema: {
				type: "array",
				items: {
					type: "string",
				},
			},
			description:
				"A `{geography}/{release}` identity, such as `localAuthority/2025-05-uk-bgc-v2`. Repeatable.\n",
		},
		{
			name: "crosswalk",
			in: "query",
			required: false,
			schema: {
				type: "array",
				items: {
					type: "string",
				},
			},
			description: "A crosswalk id from `GET /crosswalks`. Repeatable.",
		},
	],
	operationId: "getAttribution",
	tags: ["Governance"],
	summary: "Assemble the attribution and licence block for named resources",
	"x-likely-refusal": {
		status: 400,
		when: "No resource is named to attribute.",
		"x-example-request": "/v1/attribution",
	},
	description:
		"Collects the publisher, source and licence of every resource behind an answer, and returns a plain-text block suitable for a map corner, a report footer or a bulk-download README. Name at least one of `dataset`, `measure`, `boundaryRelease` or `crosswalk`; each may be repeated, and a resource named more than one way is listed once.\nA measure is attributed through the datasets its observations come from. A crosswalk is compiled by the Atlas rather than obtained, so it carries no licence of its own and the boundary releases at its endpoints are attributed instead, with the crosswalk listing them in `derivedFrom`.\nLicence names are reproduced exactly as the publisher states them and are not interpreted. One catalogue source already carries two licences across its date range, so which terms govern a combined work is the caller's judgement rather than this API's.\n",
	responses: {
		"200": {
			description:
				"The resources, the distinct licences that apply, and a ready-to-use plain-text attribution block.\n",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request":
						"/v1/attribution?measure=ghg-emissions&boundaryRelease=localAuthority/2025-05-uk-bgc-v2",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							atlasRelease: {
								id: "sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
								href: "/v1/atlas-release",
							},
							resources: [
								{
									kind: "dataset",
									id: "ghg-emissions",
									label: "Greenhouse Gas Emissions",
									href: "/v1/datasets/ghg-emissions",
									publisher:
										"Department for Energy Security and Net Zero",
									sourceUrl:
										"https://www.gov.uk/government/statistics/uk-local-authority-and-regional-greenhouse-gas-emissions-statistics-2005-to-2024",
									licence: {
										name: "Open Government Licence v3.0",
										url: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
									},
								},
							],
							licences: [
								{
									name: "Open Government Licence v3.0",
									url: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
								},
							],
							note: "Licence names are reproduced as the publisher states them and are not interpreted here. Where several apply, check each before reusing the combined work.",
						},
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
