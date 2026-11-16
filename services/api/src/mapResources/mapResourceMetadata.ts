export const mapResourceMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Geography",
		},
		{
			$ref: "#/components/parameters/Release",
		},
	],
	operationId: "getMapResource",
	tags: ["Geography"],
	summary:
		"Describe one map resource, its tiles and what they were made from",
	"x-likely-refusal": {
		status: 404,
		when: "The boundary release is published but could not be compiled into a map resource, for example because its areas overlap. `/v1/boundary-releases/{geography}/{release}` says why under `downloads`, and `/v1/map-resources` lists the ones that are.",
		"x-example-request": "/v1/map-resources/ward/2017-12-gb-bgc",
	},
	description:
		"The only document a client needs to read to draw this release. It carries the tile and archive URLs, the zoom ladder and the tier behind each zoom, the content hash of the archive, the publisher file the shapes were compiled from, and the attribution to display beside the map.\n",
	responses: {
		"200": {
			description: "The map resource descriptor.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/MapResourceEnvelope",
					},
					"x-example-request":
						"/v1/map-resources/localAuthority/2023-05-uk-bgc-v2",
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
