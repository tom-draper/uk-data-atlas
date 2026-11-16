export const postcodeMetadata = {
	parameters: [
		{
			name: "postcode",
			in: "path",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"A full unit postcode, such as `SW1A 1AA` or `sw1a1aa`.",
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
			$ref: "#/components/parameters/PostcodeView",
		},
	],
	operationId: "resolvePostcode",
	tags: ["Start here"],
	summary: "Find where a postcode is and the areas containing it",
	"x-likely-refusal": {
		status: 400,
		when: "A postcode district or sector is given rather than a full unit postcode.",
		"x-example-request": "/v1/postcodes/SW1A",
	},
	description:
		"Looks a unit postcode up in the ONS Postcode Directory and places its centroid in each requested geography, through the same point lookup as `/areas:contains`. The postcode is read in any case, with or without its space.\n\nWith no `geography` or `release`, the postcode is placed in its local authority, ward and Westminster constituency. With no `date`, each release is the latest dated on or before the directory's edition, and `dateBasis` says which was used. Terminated postcodes are served, with the month they were terminated.\n\nA postcode is placed by a single centroid, and its addresses can fall on both sides of a boundary. The centroid's positional quality comes from the directory; where the directory states an accuracy it becomes the point's uncertainty and counts towards `positionalToleranceM`. Where it does not, as for centroids ONS imputed or set at a postcode sector's mean, `caution` says that `nearBoundary` may understate the risk. A postcode with no grid reference, such as one in the Channel Islands or the Isle of Man, is described but placed in no area.\n\nNorthern Ireland postcodes are licensed by Land and Property Services for internal business use only and are refused with 451. The source's required attribution is returned with every answer.\n\n`view=compact` returns only the postcode, its WGS 84 point, each area it is placed in and the attribution, for callers that do not need the provenance and tolerances; it is a fraction of the size.\n",
	responses: {
		"200": {
			description:
				"The postcode, its centroid and the areas containing it.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/PostcodeLookupEnvelope",
					},
					"x-example-request": "/v1/postcodes/SW1A1AA",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:9e5c1f2b00f6d7becc55f3e569310568fdcbd59cbdf754f70f5dfc8cb2d4a8e8",
						data: {
							postcode: "SW1A 1AA",
							status: "live",
							introduced: "1980-01",
							userType: "large",
							country: "E92000001",
							centroid: {
								crs: "EPSG:27700",
								easting: 529090,
								northing: 179645,
								positionalQuality: {
									indicator: 1,
									description:
										"Within the building of the matched address closest to the postcode mean.",
									accuracyM: 0.5,
								},
							},
							point: {
								lng: -0.141588,
								lat: 51.501009,
								crs: "EPSG:4326",
								precision: {
									uncertaintyM: 2.5,
									basis: "decimal-places-and-transformation",
								},
							},
							date: "2026-08",
							dateBasis: "directory-edition",
							pointCountry: {
								code: "GB-ENG",
								determinedBy: "area-code",
							},
							boundaryRule: "included",
							results: [
								{
									geography: "localAuthority",
									boundaryRelease: "2026-05-uk-bgc",
									status: "matched",
									matches: [
										{
											id: "localAuthority/2026-05-uk-bgc/E09000033",
											code: "E09000033",
											name: "Westminster",
											nearBoundary: false,
										},
									],
								},
								{
									geography: "ward",
									boundaryRelease: "2026-05-uk-bgc",
									status: "matched",
									matches: [
										{
											id: "ward/2026-05-uk-bgc/E05013806",
											code: "E05013806",
											name: "St James's",
											nearBoundary: false,
										},
									],
								},
								{
									geography: "constituency",
									boundaryRelease: "2024-07-uk-bgc",
									status: "matched",
									matches: [
										{
											id: "constituency/2024-07-uk-bgc/E14001172",
											code: "E14001172",
											name: "Cities of London and Westminster",
											nearBoundary: false,
										},
									],
								},
							],
							source: {
								title: "ONS Postcode Directory (August 2026)",
								edition: "2026-08",
								publisher: "Office for National Statistics",
							},
						},
					},
				},
			},
		},
		"400": {
			description:
				"The postcode is not a UK postcode, or names a district or sector rather than a unit; or the geography, release or date is malformed as for `/areas:contains`.\n",
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
				"The postcode is not in the directory edition served, or a pinned release or geography is unknown.\n",
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
