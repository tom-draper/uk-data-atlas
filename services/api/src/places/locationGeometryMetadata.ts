export const locationGeometryMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/LocationId",
		},
	],
	operationId: "getNamedLocationGeometry",
	tags: ["Geography"],
	summary: "Get a curated area's compiled GeoJSON geometry",
	"x-likely-refusal": {
		status: 404,
		when: "The location id is not listed by `/v1/locations`.",
		"x-example-request": "/v1/locations/nowhere/geometry",
	},
	description:
		"Returns the compiled union geometry for the location's fully resolved member release. It is unavailable rather than estimated when no such geometry has been built.\n",
	responses: {
		"200": {
			description: "The location as a GeoJSON Feature.",
			content: {
				"application/json": {
					schema: {
						type: "object",
					},
					"x-example-request":
						"/v1/locations/greater-manchester/geometry",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							type: "Feature",
							id: "greater-manchester",
							properties: {
								id: "greater-manchester",
								label: "Greater Manchester",
								memberGeography: "localAuthority",
								boundaryRelease: "2026-05-uk-bgc",
								bbox: [-2.73, 53.33, -1.91, 53.69],
							},
							geometry: {
								type: "MultiPolygon",
								coordinates: [
									[
										[
											[-2.73, 53.33],
											[-1.91, 53.33],
											[-1.91, 53.69],
											[-2.73, 53.33],
										],
									],
								],
							},
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
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
