export const locationMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/LocationId",
		},
		{
			name: "asOf",
			in: "query",
			schema: {
				type: "string",
				format: "date",
			},
			description:
				"Select the member codes effective on this date. Omit it to return the complete dated definition.",
		},
		{
			name: "include",
			in: "query",
			required: false,
			schema: {
				type: "array",
				items: {
					type: "string",
					enum: ["capabilities"],
				},
			},
			style: "form",
			explode: false,
			description:
				"`capabilities` lists, under `capabilities`, the compiled releases where the location's member codes can be read directly (`direct`), plus each materialised crosswalk view into those members (`members`) and out to its parents (`parents`). A view is a link with the exact geography, release and crosswalk to request; the API never chooses a crosswalk silently. A `partial` direct view contains some, but not all, listed member codes. A `not-built` result identifies a deployment that has not loaded the projection inventory.\n",
		},
	],
	operationId: "getNamedLocation",
	tags: ["Geography"],
	summary: "Get one curated area collection's definition",
	"x-likely-refusal": {
		status: 404,
		when: "The id is guessed rather than listed. `/v1/locations?q=` searches them by name.",
		"x-example-request": "/v1/locations/wessex",
	},
	responses: {
		"200": {
			description: "The location's definition, source codes and bounds.",
			content: {
				"application/json": {
					schema: {
						type: "object",
					},
					"x-example-request": "/v1/locations/london",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							id: "london",
							label: "London",
							kind: "region",
							source: {
								publisher: "Office for National Statistics",
								lookup: "local-authority-to-region/2025-04-en",
								code: "E12000007",
							},
							definitionRevision: 2,
							memberGeography: "localAuthority",
							memberCodes: ["E09000001"],
							validity: {
								from: null,
								to: null,
							},
							bbox: [-0.5],
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
