export const areaContainsBatchMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/PointLookupCrs",
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
	],
	operationId: "findContainingAreasForPoints",
	"x-rate-limit-cost": 10,
	tags: ["Map"],
	summary: "Find the areas containing each of a bounded batch of points",
	"x-likely-refusal": {
		status: 400,
		when: "The body gives no point.",
		"x-example-request": "/v1/areas:containsBatch",
	},
	description:
		"The `areas:contains` lookup for up to 100 points at once, each given in the JSON body's `points` array as `{lng},{lat}` or `{lng},{lat},{accuracy}` in the default WGS 84, as `point={easting},{northing}` with `crs=EPSG:27700` or `EPSG:29902`, or as one Ordnance Survey reference such as `point=TQ3000080000` with `crs=EPSG:27700`. Geographies, release selection and statuses are exactly as for a single point.\n\nRelease-wide facts, including selection, coverage, resolution and geometry provenance, are given once in `releases`. Each point then lists its country and, per release in the same order, its status and matches; a match carries `corrections` only where a declared grid correction moved that area. `summary` counts the lookups by outcome and how many have a match near a boundary.\n\nEvery release is read once for all the points, so the cost of a batch grows with its points rather than with its points times its geographies. This is a bounded convenience for a caller's own point dataset, not a bulk geocoder: for more points, page through them in batches.\n",
	requestBody: {
		required: true,
		content: {
			"application/json": {
				schema: {
					type: "object",
					required: ["points"],
					properties: {
						points: {
							type: "array",
							minItems: 1,
							maxItems: 100,
							items: {
								type: "string",
								description:
									"`{lng},{lat}` in plain decimal WGS 84 degrees, optionally followed by `,{accuracy}` in metres. With a grid `crs`, use `{easting},{northing}` instead; British National Grid also accepts one Ordnance Survey grid reference such as `TQ3000080000`.\n",
							},
						},
					},
				},
				example: {
					points: ["-1.5491,53.8008", "1.0,54.5"],
				},
			},
		},
	},
	responses: {
		"200": {
			description:
				"Each point's containing areas in every requested release.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/PointContainmentBatchEnvelope",
					},
					"x-example-request":
						"/v1/areas:containsBatch?geography=localAuthority&date=2025-06-01",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:da4898229392e8fa52cd5098cf24c52f11abf454b0adcab178c6c82e30032c15",
						data: {
							date: "2025-06-01",
							boundaryRule: "included",
							releases: [
								{
									geography: "localAuthority",
									boundaryRelease: "2025-05-uk-bgc-v2",
									selection: {
										policy: "latest-release-dated-on-or-before",
										date: "2025-06-01",
									},
									boundaryResolution: {
										generalisation: "generalised-20m",
										toleranceM: 20,
									},
									geometrySource: {
										sourceCrs: "EPSG:4326",
									},
								},
							],
							summary: {
								points: 2,
								lookups: 2,
								matched: 1,
								noMatch: 0,
								outsideCoverage: 1,
								unresolved: 0,
								nearBoundary: 0,
							},
							points: [
								{
									index: 0,
									point: {
										lng: -1.5491,
										lat: 53.8008,
									},
									country: {
										code: "GB-ENG",
										determinedBy: "area-code",
										area: "localAuthority/2025-05-uk-bgc-v2/E08000035",
									},
									results: [
										{
											geography: "localAuthority",
											boundaryRelease:
												"2025-05-uk-bgc-v2",
											status: "matched",
											positionalToleranceM: 25.57,
											matches: [
												{
													id: "localAuthority/2025-05-uk-bgc-v2/E08000035",
													code: "E08000035",
													name: "Leeds",
													containment: "interior",
													distanceToBoundaryM: 6460.39,
													nearBoundary: false,
												},
											],
										},
									],
								},
								{
									index: 1,
									point: {
										lng: 1,
										lat: 54.5,
									},
									country: {
										code: null,
										determinedBy: "country-boundary",
										boundaryRelease: "2024-12-uk-bgc",
									},
									results: [
										{
											geography: "localAuthority",
											status: "outside-coverage",
											reason: "outside-uk-boundaries",
											matches: [],
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
				"No point is given, more than 100 are, or one is malformed, and the detail names it; or the geographies, releases, date or accuracy are refused as for `areas:contains`.\n",
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
