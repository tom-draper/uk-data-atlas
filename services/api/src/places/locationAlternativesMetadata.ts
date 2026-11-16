export const locationAlternativesMetadata = {
	parameters: [
		{
			name: "q",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description: "Case-insensitive real-world name, for example Devon.",
		},
	],
	operationId: "getNamedLocationAlternatives",
	tags: ["Geography"],
	summary: "List competing named-location definitions for a real-world name",
	"x-likely-refusal": {
		status: 400,
		when: "No name is given. The route lists the definitions of one name, so `q` is required.",
		"x-example-request": "/v1/locations/alternatives",
	},
	responses: {
		"200": {
			description: "Definitions distinguished by kind and source.",
			content: {
				"application/json": {
					schema: {
						type: "object",
					},
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
	},
} as const;
