export const mapResourceTileJsonMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Geography",
		},
		{
			$ref: "#/components/parameters/Release",
		},
	],
	operationId: "getMapResourceTileJson",
	tags: ["Geography"],
	summary: "The TileJSON a renderer is configured with",
	"x-likely-refusal": {
		status: 404,
		when: "The boundary release is published but could not be compiled into a map resource, for example because its areas overlap. `/v1/boundary-releases/{geography}/{release}` says why under `downloads`, and `/v1/map-resources` lists the ones that are.",
		"x-example-request": "/v1/map-resources/ward/2017-12-gb-bgc/tiles.json",
	},
	description:
		"TileJSON 3.0 for this resource, including the attribution a map must display. A tile cannot carry a licence, so a client handed only a tile URL would have nothing to show; this is the document that supplies it.\n",
	responses: {
		"200": {
			description: "TileJSON 3.0 describing the tile endpoint.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/TileJsonEnvelope",
					},
					"x-example-request":
						"/v1/map-resources/localAuthority/2023-05-uk-bgc-v2/tiles.json",
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
