export const postcodeBatchMetadata = {
	parameters: [
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
	operationId: "resolvePostcodes",
	"x-rate-limit-cost": 5,
	tags: ["Start here"],
	summary:
		"Find where each of a batch of postcodes is and the areas containing it",
	"x-likely-refusal": {
		status: 400,
		when: "The body gives no postcode, or more than 100.",
		"x-example-request": "/v1/postcodes:batch",
	},
	description:
		"The `/postcodes/{postcode}` lookup for up to 100 postcodes at once. Send them in the JSON body's `postcodes` array. The releases are chosen once for the whole batch, as for a single postcode: the default geographies as at the directory's edition unless query `geography`, `release` or `date` say otherwise.\n\nEach postcode has its own entry, in the order given, with a `status`: `placed`, with its areas; `not-placed`, for a postcode the directory gives no grid reference; `invalid`, for text that is not a unit postcode; `not-found`, for one the directory edition does not hold; and `not-served`, for a Northern Ireland postcode, which this API is not licensed to serve. None of these fails the batch. Only a problem with the request itself does, such as no postcodes, too many, or a malformed date.\n\nPlaced centroids are tested together, so each release's geometry is read once for the batch, and release-wide provenance is given once in `releases`. `summary` counts each postcode status and each lookup outcome. `view=compact` keeps the entries and summary but gives each postcode only its record, point and areas, as for a single postcode.\n",
	requestBody: {
		required: true,
		content: {
			"application/json": {
				schema: {
					type: "object",
					required: ["postcodes"],
					properties: {
						postcodes: {
							type: "array",
							minItems: 1,
							maxItems: 100,
							items: {
								type: "string",
							},
						},
					},
				},
				example: {
					postcodes: ["SW1A1AA", "M11AE", "CF101EP", "BT11AA"],
				},
			},
		},
	},
	responses: {
		"200": {
			description: "Each postcode's entry, and a summary of the batch.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/PostcodeBatchEnvelope",
					},
					"x-example-request":
						"/v1/postcodes:batch?geography=localAuthority",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:9e5c1f2b00f6d7becc55f3e569310568fdcbd59cbdf754f70f5dfc8cb2d4a8e8",
						data: {
							date: "2026-08",
							dateBasis: "directory-edition",
							boundaryRule: "included",
							releases: [
								{
									geography: "localAuthority",
									boundaryRelease: "2026-05-uk-bgc",
								},
							],
							summary: {
								postcodes: 4,
								placed: 3,
								notPlaced: 0,
								invalid: 0,
								notFound: 0,
								notServed: 1,
								lookups: 3,
								matched: 3,
								noMatch: 0,
								outsideCoverage: 0,
								unresolved: 0,
								nearBoundary: 0,
							},
							postcodes: [
								{
									index: 0,
									input: "SW1A1AA",
									status: "placed",
									postcode: {
										postcode: "SW1A 1AA",
										status: "live",
									},
									results: [
										{
											geography: "localAuthority",
											boundaryRelease: "2026-05-uk-bgc",
											status: "matched",
											matches: [
												{
													id: "localAuthority/2026-05-uk-bgc/E09000033",
													name: "Westminster",
													nearBoundary: false,
												},
											],
										},
									],
								},
								{
									index: 1,
									input: "M11AE",
									status: "placed",
									results: [
										{
											geography: "localAuthority",
											status: "matched",
											matches: [
												{
													id: "localAuthority/2026-05-uk-bgc/E08000003",
													name: "Manchester",
												},
											],
										},
									],
								},
								{
									index: 2,
									input: "CF101EP",
									status: "placed",
									results: [
										{
											geography: "localAuthority",
											status: "matched",
											matches: [
												{
													id: "localAuthority/2026-05-uk-bgc/W06000015",
													name: "Cardiff",
												},
											],
										},
									],
								},
								{
									index: 3,
									input: "BT11AA",
									status: "not-served",
									detail: "Northern Ireland postcodes are licensed by Land and Property Services for internal business use only, so this API does not serve them.",
								},
							],
						},
					},
				},
			},
		},
		"400": {
			description:
				"No postcode is given, more than 100 are, or the geography, release or date is malformed as for `/areas:contains`.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"404": {
			description: "A pinned release or a geography is unknown.",
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
