export const mapResourceTileMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Geography",
		},
		{
			$ref: "#/components/parameters/Release",
		},
		{
			name: "z",
			in: "path",
			required: true,
			description:
				"Zoom level, within the range the descriptor publishes.",
			schema: {
				type: "integer",
				minimum: 0,
			},
		},
		{
			name: "x",
			in: "path",
			required: true,
			description: "Tile column at this zoom.",
			schema: {
				type: "integer",
				minimum: 0,
			},
		},
		{
			name: "y",
			in: "path",
			required: true,
			description: "Tile row at this zoom, counted from the north.",
			schema: {
				type: "integer",
				minimum: 0,
			},
		},
	],
	operationId: "getMapResourceTile",
	tags: ["Geography"],
	summary: "One vector tile of a boundary release",
	"x-likely-refusal": {
		status: 404,
		when: "The zoom is past the last one the descriptor publishes. A renderer should over-zoom rather than request it.",
		"x-example-request":
			"/v1/map-resources/localAuthority/2023-05-uk-bgc-v2/tiles/13/4000/2600.mvt",
	},
	description:
		"A Mapbox Vector Tile carrying the `boundaries` layer, gzipped as the archive stores it. Each feature has the area's `code`, its `name` and a stable integer id a renderer can hold state against. Values are not in the tile: one tileset serves every measure, and a value is joined in the renderer. A tile inside the published zooms that covers no area is answered `204`, which is an ordinary answer rather than a failure; a zoom the resource does not publish is `404`, and a renderer should over-zoom past the last one instead.\n",
	responses: {
		"200": {
			description: "The tile, gzipped.",
			content: {
				"application/vnd.mapbox-vector-tile": {
					schema: {
						type: "string",
						format: "binary",
					},
				},
			},
		},
		"204": {
			description: "No area falls in this tile.",
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
