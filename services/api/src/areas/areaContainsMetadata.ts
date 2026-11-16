export const areaContainsMetadata = {
	parameters: [
		{
			name: "lng",
			in: "query",
			required: false,
			schema: {
				type: "string",
				pattern: "^[+-]?\\d+(\\.\\d+)?$",
			},
			description:
				"Longitude in WGS 84 decimal degrees, -180 to 180. Written as a plain decimal: its decimal places are read as its precision.\n",
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
			description:
				"Latitude in WGS 84 decimal degrees, -90 to 90, as for `lng`.",
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
			name: "postcode",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"A unit postcode such as `SW1A 1AA`, the space optional, in place of a coordinate. It cannot be combined with `lng`, `lat`, `easting`, `northing`, `gridref`, `crs` or `accuracy`.\n",
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
	operationId: "findContainingAreas",
	tags: ["Map"],
	summary: "Find the areas containing a point in one or more geographies",
	"x-likely-refusal": {
		status: 400,
		when: "The coordinate is incomplete or out of range.",
		"x-example-request": "/v1/areas:contains?lng=-2.24&geography=ward",
	},
	description:
		"Tests a point against one boundary release of each requested geography, at most four in one request, and says for each what contains it or why nothing does.\n\nSupply WGS 84 `lng` (also accepted as `lon` or `longitude`) and `lat` (the default), or set `crs=EPSG:27700` and supply British National Grid `easting` and `northing` or an Ordnance Survey `gridref` such as `TQ 30000 80000`. Set `crs=EPSG:29902` for Irish Grid metres. Or give a unit `postcode` instead of a coordinate: it is placed by its ONS Postcode Directory centroid, with the directory's own stated accuracy, exactly as `/postcodes/{postcode}` places it, and the answer names the postcode. A grid reference denotes a square, so its answer uses the cell centre and includes its whole half-diagonal as uncertainty. Every answer is normalised to WGS 84 and retains the input coordinate and named transformation.\n\nEach geography's release is either pinned, as `release={geography}/{release}`, chosen for `date` as the latest one dated on or before it, or defaults to the newest unambiguous published release. With neither `geography` nor `release`, the lookup covers `localAuthority`, `ward` and `constituency`. Every result states its selection policy. A date no release fits, or one several releases of the same month fit equally, is reported in that geography's result as `no-release-for-date` or `ambiguous-release` rather than failing the whole lookup.\n\nPoints on an exterior or hole ring are included and labelled `boundary`, so a point on a shared border returns every area sharing it. A result with no match is `outside-coverage` when the point's country is outside the release's coverage, or outside every UK country boundary, and `no-match` when the release covers the point's country but no area of it contains the point. The country comes from a matched area's code where one has it, and otherwise from the country boundaries, and `country.determinedBy` says which.\n\nEvery result states how far its answer can be trusted. `positionalToleranceM` adds the coordinate's uncertainty, taken from `accuracy` or else from its written decimal places, the boundary's generalisation, read from the ONS release name, and the stated accuracy of any transformation from the source CRS to WGS 84. A match whose edge lies within that tolerance is `nearBoundary`. The geometry's source file, hash, CRS and transformation are given for each release and each match.\n\nEach release is read into memory on first use, which can take a second or more for a large release; later lookups against it are fast.\n",
	responses: {
		"200": {
			description:
				"Each requested geography's containing areas, or why there are none.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/PointContainmentEnvelope",
					},
					"x-example-request":
						"/v1/areas:contains?lng=-3.1791&lat=51.4816&geography=ward&geography=localHealthBoard&geography=combinedAuthority&date=2025-06-01",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:da4898229392e8fa52cd5098cf24c52f11abf454b0adcab178c6c82e30032c15",
						data: {
							point: {
								lng: -3.1791,
								lat: 51.4816,
								crs: "EPSG:4326",
								precision: {
									decimalPlaces: {
										lng: 4,
										lat: 4,
									},
									uncertaintyM: 5.56,
									basis: "decimal-places",
								},
							},
							date: "2025-06-01",
							country: {
								code: "GB-WLS",
								determinedBy: "area-code",
								area: "ward/2025-05-uk-bgc-v2/W05001274",
							},
							boundaryRule: "included",
							results: [
								{
									geography: "ward",
									boundaryRelease: "2025-05-uk-bgc-v2",
									href: "/v1/boundary-releases/ward/2025-05-uk-bgc-v2",
									selection: {
										policy: "latest-release-dated-on-or-before",
										date: "2025-06-01",
										sameMonth: false,
									},
									boundaryResolution: {
										generalisation: "generalised-20m",
										extent: "clipped-to-coastline",
										toleranceM: 20,
										basis: "ons-release-name",
									},
									geometrySource: {
										sourceCrs: "EPSG:4326",
									},
									status: "matched",
									positionalToleranceM: 25.56,
									matches: [
										{
											id: "ward/2025-05-uk-bgc-v2/W05001274",
											code: "W05001274",
											name: "Cathays",
											containment: "interior",
											distanceToBoundaryM: 465.67,
											nearBoundary: false,
										},
									],
								},
								{
									geography: "localHealthBoard",
									boundaryRelease: "2023-12-w-bgc",
									coverage: {
										countries: ["GB-WLS"],
									},
									status: "matched",
									matches: [
										{
											id: "localHealthBoard/2023-12-w-bgc/W11000029",
											code: "W11000029",
											name: "Cardiff and Vale University Health Board",
											containment: "interior",
											nearBoundary: false,
										},
									],
								},
								{
									geography: "combinedAuthority",
									selection: {
										policy: "latest-release-dated-on-or-before",
										date: "2025-06-01",
									},
									status: "no-release-for-date",
									detail: "The earliest combinedAuthority boundary release is dated 2025-12, after 2025-06.",
									earliest: {
										id: "2025-12-en-bgc",
										month: "2025-12",
									},
									matches: [],
								},
							],
						},
					},
				},
			},
		},
		"400": {
			description:
				"The point is missing, malformed or out of range; a postcode is not a unit postcode, or is given with a coordinate; more than four geographies are named; a geography has neither a pinned release nor a date; a bare release id is given with several geographies; or `date` or `accuracy` is malformed.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"404": {
			description:
				"A pinned release is not published or not compiled, or a geography is unknown; or the postcode is not in the directory edition served, or the directory gives it no grid reference.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"451": {
			description:
				"The postcode is in Northern Ireland, which this API is not licensed to serve.",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
