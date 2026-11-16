export const locationComparisonMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/LocationId",
		},
		{
			name: "from",
			in: "query",
			required: true,
			schema: {
				type: "string",
				format: "date",
			},
		},
		{
			name: "to",
			in: "query",
			required: true,
			schema: {
				type: "string",
				format: "date",
			},
		},
	],
	operationId: "compareNamedLocationMembership",
	tags: ["Geography"],
	summary: "Compare a named location's direct membership between two dates",
	"x-likely-refusal": {
		status: 400,
		when: "A date is missing or is a year rather than a calendar date. `from` and `to` are both YYYY-MM-DD.",
		"x-example-request":
			"/v1/locations/lancashire/comparison?from=1974&to=2026-01-01",
	},
	responses: {
		"200": {
			description: "Retained, added and removed direct member codes.",
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
		"404": {
			$ref: "#/components/responses/NotFound",
		},
	},
} as const;
