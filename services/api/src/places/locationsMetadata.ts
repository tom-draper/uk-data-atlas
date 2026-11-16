export const locationsMetadata = {
	parameters: [
		{
			name: "q",
			in: "query",
			schema: {
				type: "string",
			},
			description:
				"Matches a named location's label, case and punctuation aside. Omit it to list every curated location.\n",
		},
		{
			name: "asOf",
			in: "query",
			schema: {
				type: "string",
				format: "date",
			},
			description:
				"Select the member codes effective on this date. Omit it to return the complete dated definition.",
		},
		{
			$ref: "#/components/parameters/PageCursor",
		},
		{
			$ref: "#/components/parameters/PageLimit",
		},
	],
	operationId: "listNamedLocations",
	tags: ["Geography"],
	summary: "List the curated area collections",
	"x-likely-refusal": {
		status: 503,
		when: "A search that matches nothing is an empty list, not a refusal. Refused only when the server was started without named locations built.",
	},
	description:
		"A named location is a curated area collection. Most are editorial groupings of area codes (`kind: editorial-grouping`), kept because people ask for places the official geographies do not name. Countries, English regions, Greater Manchester and some counties are official areas (`kind: country`, `region`, `combined-authority` or `county`), and all but countries name the ONS lookup their current members come from in `source`.\n\nThe ceremonial counties of England and preserved counties of Wales, which is what most people mean by Lancashire or Kent, are `kind: ceremonial-county`. No ONS lookup defines them, so `source` names Ordnance Survey's Boundary-Line polygons and the method: each local authority of every compiled release is a member of the county holding most of its area, and dated by the releases it appears in, so a county keeps the councils it had before a reorganisation. An authority split between counties, as Stockton-on-Tees is between County Durham and North Yorkshire, is a member of the one holding most of it and listed with its share in the other's `partialMembers`. A county that shares its name with a different official area, as the West Midlands shares the region's, is `{id}-ceremonial-county`; one with the same councils as an official county is that county. Scotland's lieutenancy areas do not follow council boundaries and are not included.\n\nNone is a generic geographic location, and membership holds only through a crosswalk the caller names. `q` matches an id or label prefix. `definitionRevision` identifies the curated definition used; `validity` gives its known bounds, with null bounds when the curator has not supplied dates. `memberAssertions` gives each member code's half-open effective interval; `asOf` selects the definition active on one date. Geometry is deliberately omitted from this paginated listing; fetch a selected location's geometry from `/v1/locations/{location-id}/geometry`.\n",
	responses: {
		"200": {
			description: "Named location definitions.",
			content: {
				"application/json": {
					schema: {
						type: "object",
					},
					"x-example-request": "/v1/locations?q=york",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: [
							{
								id: "york",
								label: "York",
								kind: "editorial-grouping",
								definitionRevision: 1,
								memberGeography: "localAuthority",
								memberCodes: ["E06000014"],
								validity: {
									from: null,
									to: null,
								},
								bbox: [-1.15],
							},
						],
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
