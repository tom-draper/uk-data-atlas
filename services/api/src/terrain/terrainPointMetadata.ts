export const terrainPointMetadata = {
	parameters: [
		{
			name: "x",
			in: "query",
			required: true,
			schema: {
				type: "number",
			},
			description: "Easting in EPSG:27700 metres.",
		},
		{
			name: "y",
			in: "query",
			required: true,
			schema: {
				type: "number",
			},
			description: "Northing in EPSG:27700 metres.",
		},
		{
			name: "interpolation",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["bilinear", "nearest"],
				default: "bilinear",
			},
			description: "Interpolation method applied to the source raster.",
		},
		{
			name: "version",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Exact source version; omitted selects the provider default.",
		},
	],
	operationId: "getTerrainElevationPoint",
	tags: ["Terrain"],
	summary: "Get one terrain elevation point",
	description:
		"Returns a bare-earth elevation sampled in British National Grid metres. The answer identifies the exact source version and tile hash used. An outside-coverage or no-data point is a successful response with an explicit status; neither is converted into a plausible elevation. This endpoint requires a configured terrain provider and does not imply that the catalogue's planned products are published.\n",
	"x-likely-refusal": {
		status: 400,
		when: "x or y is missing or is not a finite EPSG:27700 coordinate.",
		"x-example-request":
			"/v1/terrain/elevation/point?x=not-a-number&y=180000",
	},
	responses: {
		"200": {
			description: "Elevation value or explicit coverage/data absence.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/TerrainPointEnvelope",
					},
					"x-example-request":
						"/v1/terrain/elevation/point?x=530000&y=180000&interpolation=bilinear",
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
