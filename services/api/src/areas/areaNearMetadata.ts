export const areaNearMetadata = {
	parameters: [
		{
			name: "lng",
			in: "query",
			required: false,
			schema: {
				type: "string",
				pattern: "^[+-]?\\d+(\\.\\d+)?$",
			},
			description: "Longitude in WGS 84 decimal degrees, -180 to 180.",
		},
		{
			$ref: "#/components/parameters/PointLookupLongitudeAlias",
		},
		{
			$ref: "#/components/parameters/PointLookupLongitudeLongAlias",
		},
		{
			name: "lat",
			in: "query",
			required: false,
			schema: {
				type: "string",
				pattern: "^[+-]?\\d+(\\.\\d+)?$",
			},
			description: "Latitude in WGS 84 decimal degrees, -90 to 90.",
		},
		{
			$ref: "#/components/parameters/PointLookupCrs",
		},
		{
			$ref: "#/components/parameters/PointLookupEasting",
		},
		{
			$ref: "#/components/parameters/PointLookupNorthing",
		},
		{
			$ref: "#/components/parameters/PointLookupGridReference",
		},
		{
			$ref: "#/components/parameters/PointLookupGeography",
		},
		{
			$ref: "#/components/parameters/PointLookupRelease",
		},
		{
			$ref: "#/components/parameters/PointLookupDate",
		},
		{
			$ref: "#/components/parameters/PointLookupAccuracy",
		},
		{
			name: "limit",
			in: "query",
			required: false,
			schema: {
				type: "integer",
				minimum: 1,
				maximum: 10,
				default: 1,
			},
			description: "How many areas to return per geography, 1 to 10.",
		},
		{
			name: "within",
			in: "query",
			required: false,
			schema: {
				type: "integer",
				minimum: 1,
				maximum: 50000,
				default: 1000,
			},
			description:
				"The furthest an area may be, in whole metres, up to 50 km.",
		},
	],
	operationId: "findNearestAreas",
	"x-rate-limit-cost": 5,
	tags: ["Map"],
	summary: "Rank the areas nearest a point by distance",
	"x-likely-refusal": {
		status: 400,
		when: "The coordinate is incomplete or out of range.",
		"x-example-request": "/v1/areas:near?lng=-2.24",
	},
	description:
		"Returns up to `limit` areas of each requested geography whose published geometry lies within `within` metres of the point, nearest first. Releases are selected exactly as for `areas:contains`.\n\nThe coordinate forms are the same as `areas:contains`: default WGS 84 `lng`/`lat` (`lon` and `longitude` are also accepted for longitude), British National Grid `easting`/`northing` or an Ordnance Survey `gridref` with `crs=EPSG:27700`, or Irish Grid metres with `crs=EPSG:29902`.\n\nThis is a distance answer, labelled `relation: distance`, and never a containment one. An area at zero metres has the point on or inside it, but only `areas:contains` makes that claim, with its boundary rule and tolerance. Use this route where containment has nothing to say: a point offshore or in an estuary that a generalised boundary leaves out, or a site for which the nearest few areas all matter.\n\nDistances are to the nearest part of each area's geometry, measured on the WGS 84 ellipsoid in a plane tangent at the point, which within the 50 km this route reaches departs from the geodesic by less than a tenth of a percent. They carry the coordinate's own uncertainty, given in `point.precision`. `matched` counts every area within the distance, and `truncated` says whether `limit` cut it.\n",
	responses: {
		"200": {
			description:
				"Each requested geography's nearest areas, with their distances.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/NearestAreasEnvelope",
					},
					"x-example-request":
						"/v1/areas:near?lng=-0.5800&lat=54.5100&geography=ward&date=2025-06-01&limit=2&within=5000",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:da4898229392e8fa52cd5098cf24c52f11abf454b0adcab178c6c82e30032c15",
						data: {
							point: {
								lng: -0.58,
								lat: 54.51,
								crs: "EPSG:4326",
							},
							date: "2025-06-01",
							within: 5000,
							limit: 2,
							relation: "distance",
							results: [
								{
									geography: "ward",
									boundaryRelease: "2025-05-uk-bgc-v2",
									selection: {
										policy: "latest-release-dated-on-or-before",
										date: "2025-06-01",
									},
									status: "found",
									matched: 4,
									truncated: true,
									nearest: [
										{
											rank: 1,
											id: "ward/2025-05-uk-bgc-v2/E05014272",
											code: "E05014272",
											name: "Esk Valley & Coast",
											distanceM: 2372.3,
										},
									],
								},
							],
						},
					},
				},
			},
		},
		"400": {
			description:
				"The point, `limit`, `within` or `accuracy` is malformed or out of range, or the geographies and releases are refused as for `areas:contains`.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
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
