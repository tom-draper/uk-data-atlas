export const terrainMetadata = {
	operationId: "getTerrainCatalogue",
	tags: ["Terrain"],
	summary: "Discover terrain product families and their availability",
	description:
		"The terrain catalogue distinguishes bare-earth elevation (a digital terrain model) from surface elevation (a digital surface model), and declares slope, aspect, contours and hillshade separately. A product marked `not-published` has no values, tiles or contours to fetch; it exists so a client can discover the service boundary without treating a planned layer as data. Before a product becomes available, its version must state its CRS, vertical datum, resolution, processing, uncertainty, licence and immutable content hash.\n",
	"x-likely-refusal": {
		status: 503,
		when: "Takes no input. Refused only when the server was started without the terrain catalogue built.",
	},
	responses: {
		"200": {
			description:
				"Versioned terrain product definitions and their required metadata.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request": "/v1/terrain",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							schemaVersion: 1,
							contentHash:
								"sha256:4c7869c07f9e3e20de6f2b1af8a2a9a20e6cde1d4b68fdfeee3fb712f73b6611",
							publicationRequirements: [
								"vertical CRS or datum, including the geoid model where applicable",
								"cell resolution or contour interval",
								"uncertainty or stated accuracy",
							],
							products: [
								{
									id: "terrain-elevation",
									label: "Bare-earth elevation",
									kind: "raster",
									measurement:
										"Elevation of the terrain surface after buildings and vegetation are removed.",
									unit: "metres",
									availability: {
										status: "not-published",
										reason: "No versioned terrain source has been ingested and validated for this product yet.",
									},
									intendedCoverage: {
										countries: [
											"GB-ENG",
											"GB-NIR",
											"GB-SCT",
											"GB-WLS",
										],
									},
								},
							],
						},
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
