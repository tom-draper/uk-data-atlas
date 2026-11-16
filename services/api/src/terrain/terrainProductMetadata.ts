export const terrainProductMetadata = {
	parameters: [
		{
			name: "terrain-id",
			in: "path",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"A product id from `GET /v1/terrain`, such as `terrain-elevation` or `terrain-contours`.",
		},
	],
	operationId: "getTerrainProduct",
	tags: ["Terrain"],
	summary: "Get one terrain product definition",
	"x-likely-refusal": {
		status: 404,
		when: "The id is guessed rather than listed. `GET /v1/terrain` gives the product ids.",
		"x-example-request": "/v1/terrain/not-a-product",
	},
	responses: {
		"200": {
			description:
				"One terrain product definition and availability state.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request": "/v1/terrain/terrain-contours",
				},
			},
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
