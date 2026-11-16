export const mapResourceArchiveMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Geography",
		},
		{
			$ref: "#/components/parameters/Release",
		},
		{
			$ref: "#/components/parameters/ByteRange",
		},
	],
	operationId: "getMapResourceArchive",
	tags: ["Geography"],
	summary: "The whole tile pyramid as one PMTiles archive",
	"x-likely-refusal": {
		status: 404,
		when: "The boundary release is published but could not be compiled into a map resource, for example because its areas overlap. `/v1/boundary-releases/{geography}/{release}` says why under `downloads`, and `/v1/map-resources` lists the ones that are.",
		"x-example-request": "/v1/map-resources/ward/2017-12-gb-bgc.pmtiles",
	},
	description:
		"Every tile of the resource in a single PMTiles v3 file, for an offline map, a CDN or a warehouse. Its SHA-256 is the `contentHash` the descriptor publishes, so a drawing made from it can be tied to the Atlas release that produced it.\nIt can also be read in place: the archive honours byte-range requests, so a map library such as MapLibre with the `pmtiles` protocol can draw from this URL directly, fetching only the tiles in view.\n",
	responses: {
		"200": {
			description: "The PMTiles archive.",
			headers: {
				Deprecation: {
					$ref: "#/components/headers/ReleaseDeprecation",
				},
				Sunset: {
					$ref: "#/components/headers/ReleaseSunset",
				},
				Link: {
					$ref: "#/components/headers/ReleaseSuccessorLink",
				},
			},
			content: {
				"application/vnd.pmtiles": {
					schema: {
						type: "string",
						format: "binary",
					},
				},
			},
		},
		"206": {
			$ref: "#/components/responses/PartialContent",
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"416": {
			$ref: "#/components/responses/RangeNotSatisfiable",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
