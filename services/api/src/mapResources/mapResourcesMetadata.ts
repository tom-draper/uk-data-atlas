export const mapResourcesMetadata = {
	operationId: "listMapResources",
	tags: ["Geography"],
	summary: "List the boundary releases published as map resources",
	"x-likely-refusal": {
		status: 503,
		when: "Takes no input. Refused only when the server was started without map resources built.",
	},
	description:
		"A map resource is one boundary release prepared for drawing: tiles whose borders are compiled once and shared, so neighbours cannot be drawn two different ways. Releases are published deliberately rather than every release being tiled: most are, but a release served only as area records, such as the 2022 Scottish data zones, is not listed.\n",
	responses: {
		"200": {
			description: "One entry per published map resource.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/MapResourceListEnvelope",
					},
					"x-example-request": "/v1/map-resources",
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
