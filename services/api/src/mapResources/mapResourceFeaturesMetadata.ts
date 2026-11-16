export const mapResourceFeaturesMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Geography",
		},
		{
			$ref: "#/components/parameters/Release",
		},
		{
			name: "tier",
			in: "query",
			required: true,
			schema: {
				type: "string",
				enum: ["full", "high", "medium", "low"],
			},
			description:
				"The detail to download. `full` is the release's own geometry; each coarser tier drops detail smaller than 10, 100 or 1,000 metres.\n",
		},
		{
			name: "format",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["geoparquet", "geojson"],
				default: "geoparquet",
			},
			description: "The representation, GeoParquet 1.1 or GeoJSON.",
		},
		{
			$ref: "#/components/parameters/ByteRange",
		},
	],
	operationId: "getMapResourceFeatures",
	tags: ["Geography"],
	summary: "A whole boundary release as one GeoParquet or GeoJSON file",
	"x-likely-refusal": {
		status: 400,
		when: "No `tier` is given. The detail is the caller's to choose: `full`, `high`, `medium` or `low`.",
		"x-example-request":
			"/v1/map-resources/localAuthority/2023-05-uk-bgc-v2/features",
	},
	description:
		"The flat form of the resource, for a warehouse or a GIS that holds features rather than tiles: GeoParquet 1.1 with one row per area, carrying the same `id`, `code` and `name` as the tiles, its shape as WKB in OGC:CRS84, and a `bbox` covering column a reader can filter on. Each tier is compiled from the same shared-arc generalisation the tiles are drawn from, so neighbours share their borders exactly, and the ids are the ones a join table publishes, so values join by `id` or `code` without reading a tile. Every tier is published, `full` included, and its size and SHA-256 are listed under `features` in the descriptor. Downloads are generated from the geometry store on request, checked against their published hashes and cached within a bounded byte budget. Cold requests for large releases can take longer; generation is serialized. A coarse tier keeps every border shared but is not guaranteed to be a valid polygon everywhere, as the descriptor's `generalisation` says. The file's `uk-data-atlas` metadata names the resource, tier, attribution and publisher file hash, so a copy loaded on its own is still citable.\n`format=geojson` returns the same features as an RFC 7946 FeatureCollection, for the tools that open GeoJSON directly. It is published at the `medium` and `low` tiers only; `full` and `high` are GeoParquet only, and asking for them as GeoJSON answers 404. Each feature has the same `id`, and `code` and `name` properties; coordinates are written to six decimal places, about 0.1 m. A client sending `Accept-Encoding: gzip` receives it with `Content-Encoding: gzip` and one that does not receives it decoded. The two encodings have different `ETag`s, and the descriptor's `bytes` and `contentHash` describe the decoded GeoJSON.\nThe GeoParquet file honours byte-range requests, so DuckDB, GDAL or any reader that fetches Parquet over HTTP can read its footer and only the row groups it needs. The GeoJSON is always sent whole.\n",
	responses: {
		"200": {
			description: "The GeoParquet or GeoJSON file.",
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
				"application/vnd.apache.parquet": {
					schema: {
						type: "string",
						format: "binary",
					},
				},
				"application/geo+json": {
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
		"400": {
			$ref: "#/components/responses/InvalidQuery",
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
