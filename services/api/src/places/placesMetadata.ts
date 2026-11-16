export const placesMetadata = {
	parameters: [
		{
			name: "q",
			in: "query",
			required: true,
			description:
				"A place name, an area code, a unit postcode, or a place reference such as `localAuthority/E08000003` or `postcode/SW1A1AA`.",
			schema: {
				type: "string",
			},
			example: "Manchester",
		},
		{
			name: "limit",
			in: "query",
			required: false,
			schema: {
				type: "integer",
				minimum: 1,
				maximum: 500,
				default: 10,
			},
			description: "How many candidate places to return, 1 to 500.",
		},
		{
			name: "asOf",
			in: "query",
			required: false,
			schema: {
				type: "string",
				format: "date",
			},
			description:
				"Select the member codes effective on this date for curated named locations. Omit it to return the complete dated definition.",
		},
		{
			name: "geography",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description: "Restrict an exact area lookup to one geography type.",
		},
		{
			name: "release",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Restrict an exact area lookup to one boundary release.",
		},
		{
			name: "date",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Calendar date (`YYYY-MM-DD`) or month (`YYYY-MM`) that selects a release. Requires `geography` and cannot be combined with `release`.",
		},
		{
			name: "country",
			in: "query",
			required: false,
			schema: {
				enum: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"],
			},
			description: "Restrict a date-selected release to one country.",
		},
	],
	operationId: "resolvePlaces",
	tags: ["Start here"],
	summary: "Find every place a name could mean",
	"x-likely-refusal": {
		status: 400,
		when: "No `q` is given.",
		"x-example-request": "/v1/places",
	},
	description:
		'Turns a name into candidate places, each saying what kind of place it is. A name is rarely one area: "Manchester" is a local authority, a county and unitary authority, a major town, a travel to work area and a ward, and "Newport" is thirteen codes across Wales, the Isle of Wight and Shropshire. This never chooses among them.\n\nNames match with case, accents, punctuation and the ampersand set aside, so "Brighton & Hove" and "Ynys Mon" find what was published, and an alias matches as well as a name. An administrative title is set aside too, so "Bristol" finds the authority published as "Bristol, City of", reported as `exact-without-title`. Names that merely begin with the query follow, as `prefix`, once equal names leave room: "Richmond" lists its wards and parish first, then Richmond upon Thames. A bare area code, or a place reference, is looked up directly.\n\nA place held in several releases is returned once, with its releases newest first. Equal matches are listed headline geographies first, then wards and smaller areas; that is a presentation order and asserts nothing about which was meant. Curated named locations appear with their member codes, or the codes active on `asOf`.\n\nA unit postcode, typed in any case and with or without its space, leads the candidates as a place of its own: kind `postcode`, a place reference such as `postcode/SW1A1AA`, its centroid as `point`, and an `href` to `/postcodes/{postcode}`, which places it in areas. Nothing is placed here, so a search stays as fast as a name lookup. Pass the reference as `place` to `/data/{measure-id}/value` to answer a measure for the postcode. A query that reads as a postcode district or sector, or a unit postcode the directory does not hold or this API may not serve, carries a `postcodeHint` saying so.\n\nAdd `geography` or `release` to resolve only exact area identities in that scope. `date`, with a geography, selects the latest published release on or before that date; `country` can narrow that selection.\n',
	responses: {
		"200": {
			description:
				"The candidate places, best match first. Empty when nothing matches.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request": "/v1/places?q=Bristol",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:24a500c55416bd7d58c28b1fc8cc4931d4a2fd831addafa3116556a91f2c4857",
						data: {
							query: "Bristol",
							candidates: [
								{
									place: "localAuthority/E06000023",
									kind: "area",
									name: "Bristol, City of",
									geography: "localAuthority",
									code: "E06000023",
									match: "exact-without-title",
									boundaryReleases: [
										"2025-12-uk-bgc",
										"2023-05-uk-bgc-v2",
									],
								},
								{
									place: "majorTownAndCity/J01000015",
									kind: "area",
									name: "Bristol",
									geography: "majorTownAndCity",
									code: "J01000015",
									match: "exact",
									boundaryReleases: ["2015-12-ew-bgc"],
								},
							],
						},
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
