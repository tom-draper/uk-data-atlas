export const coordinateMetadata = {
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
			$ref: "#/components/parameters/CoordinateTargetCrs",
		},
		{
			$ref: "#/components/parameters/BritishGridReferenceDigits",
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
			$ref: "#/components/parameters/PointLookupAccuracy",
		},
	],
	operationId: "convertCoordinate",
	tags: ["Map"],
	summary:
		"Convert one supported coordinate between WGS 84 and national grids",
	"x-likely-refusal": {
		status: 400,
		when: "The coordinate is incomplete, mixed between forms, outside its declared CRS or uses a CRS the API does not transform.",
		"x-example-request":
			"/v1/coordinates:convert?crs=EPSG:27700&gridref=TQ300008000",
	},
	description:
		"Converts one horizontal coordinate without reading a boundary release. Its `point` is always normalised to WGS 84. By default that is the full response; select `to=EPSG:27700` or `to=EPSG:29902` to also receive a British National Grid or Irish Grid coordinate. Supply default WGS 84 `lng` and `lat`, British National Grid `easting` and `northing` or an Ordnance Survey `gridref` with `crs=EPSG:27700`, or Irish Grid `easting` and `northing` with `crs=EPSG:29902`.\n\nThe answer keeps the input form and named transformation. An Ordnance Survey grid reference denotes a square, not a point: the coordinate is the cell centre and uncertainty includes the square's half-diagonal. A British National Grid target also supplies its containing National Grid cell when one can represent the coordinate without overstating uncertainty; `gridrefDigits` can request a coarser cell. This route only converts horizontal position; it neither determines altitude nor implies an administrative-area relationship.\n",
	responses: {
		"200": {
			description:
				"The normalised WGS 84 coordinate, and an optional requested national-grid coordinate, with transparent precision.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/CoordinateConversionEnvelope",
					},
					"x-example-request":
						"/v1/coordinates:convert?crs=EPSG:27700&gridref=TQ3000080000",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:da4898229392e8fa52cd5098cf24c52f11abf454b0adcab178c6c82e30032c15",
						data: {
							point: {
								lng: -0.1283466,
								lat: 51.5039953,
								crs: "EPSG:4326",
								input: {
									crs: "EPSG:27700",
									easting: 530000.5,
									northing: 180000.5,
									gridReference: {
										value: "TQ 30000 80000",
										cellSizeM: 1,
										position: "cell-centre",
									},
									transformation: {
										name: "OSGB36 to WGS 84 (6)",
										epsg: "EPSG:1314",
										accuracyM: 2,
										areaOfUse:
											"Great Britain onshore and the Isle of Man.",
									},
								},
								precision: {
									decimalPlaces: {
										gridReference: {
											easting: 5,
											northing: 5,
										},
									},
									uncertaintyM: 2.71,
									basis: "grid-reference-and-transformation",
								},
							},
							targetCrs: "EPSG:4326",
							note: "This is a horizontal-coordinate conversion only. It does not determine altitude, vertical datum or an administrative area.",
						},
					},
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
	},
} as const;
