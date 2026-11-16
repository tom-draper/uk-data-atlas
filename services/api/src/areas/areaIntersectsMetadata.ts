export const areaIntersectsMetadata = {
	parameters: [
		{
			name: "bbox",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"`west,south,east,north` in WGS 84 degrees, with west < east and south < north.\n",
			example: "-0.51,51.28,0.33,51.69",
		},
		{
			name: "geography",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description: "The geography of the boundary release to search.",
		},
		{
			name: "release",
			in: "query",
			required: false,
			schema: {
				type: "string",
				default: "latest",
			},
			description:
				"The boundary release to search, whose geometry the box is tested against. Omit it, or use `latest`, for the newest unambiguous published release.\n",
		},
		{
			name: "tier",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["full", "high", "medium", "low"],
			},
			description:
				"Omit for identities only. Set to a tier to include each match's geometry, generalised to it.\n",
		},
		{
			name: "limit",
			in: "query",
			required: false,
			schema: {
				type: "integer",
				minimum: 1,
				maximum: 1000,
				default: 200,
			},
			description:
				"How many matching areas to return in a page, 1 to 1000. `truncated` says whether more follow.\n",
		},
		{
			$ref: "#/components/parameters/PageCursor",
		},
	],
	operationId: "findAreasIntersectingBox",
	"x-rate-limit-cost": 10,
	tags: ["Map"],
	summary: "Find the areas meeting a bounding box in one release",
	"x-likely-refusal": {
		status: 400,
		when: "The box has fewer than four WGS 84 coordinates, is out of range or does not run west-to-east and south-to-north.",
		"x-example-request":
			"/v1/areas:intersects?bbox=-2.3,53.4,-2.2&geography=ward&release=latest",
	},
	description:
		'Returns every area of one geography and release that meets the given WGS 84 box: the query a map makes when it pans, and the one an analysis makes to scope a region before asking for anything heavier.\n\n`relation` says how each area meets the box. `within` means the area lies entirely inside it; `overlaps` means it meets the box without being contained by it. Both are exact. An area is tested against the box itself, not against its own bounding box, so a crescent whose bounding box reaches into the query while its land does not is excluded, as is a box sitting inside a lake within an area.\n\nIdentities come back by default, each with its own bounding box, and the coordinates are opted into with `tier`, which generalises every match exactly as the geometry route does. That keeps the cost of a wide box bounded whether or not a caller wants geometry with it. The same caveat applies: above `full`, matches are generalised one at a time and neighbours drawn together may disagree along a shared border.\n\nResults come a page at a time in code order, `limit` to a page, 200 by default and 1000 at most. `matched` counts every area the box meets, `truncated` says whether more follow this page, and `nextCursor`, with a `Link: rel="next"` header, fetches them. For every area of a release, the whole-release download is quicker. The cap is on results rather than on the box: a box covering the whole country is a reasonable analysis question, and it is the geometry that is expensive, not the extent. A box matching nothing is an empty answer, not an error; a geography and release the catalogue does not carry is a 404. Geometry collections process at most 250,000 source vertices per request, counted before simplification. A larger request returns 422 without a partial collection. Reduce the page size for a box query, omit its tier to retrieve identities, or follow the problem\'s `links.downloads` to the boundary release metadata and its whole-release downloads.\n',
	responses: {
		"200": {
			description: "The areas meeting the box, and how each meets it.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/AreaBoxSearchEnvelope",
					},
					"x-example-request":
						"/v1/areas:intersects?bbox=-0.51,51.28,0.33,51.69&geography=localAuthority&release=2023-05-uk-bgc-v2",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:24a500c55416bd7d58c28b1fc8cc4931d4a2fd831addafa3116556a91f2c4857",
						data: {
							bbox: [-0.51, 51.28, 0.33, 51.69],
							geography: "localAuthority",
							boundaryRelease: "2023-05-uk-bgc-v2",
							matched: 57,
							returned: 57,
							limit: 200,
							truncated: false,
							relationRule:
								"within when the area lies entirely inside the box, overlaps when it meets the box without being contained by it. Both are exact: an area is tested against the box itself, not against its bounding box.",
							geometry:
								"Not included. Pass tier to receive it, at the cost of the coordinates.",
							matches: [
								{
									id: "localAuthority/2023-05-uk-bgc-v2/E09000007",
									code: "E09000007",
									name: "Camden",
									relation: "within",
									boundingBox: [
										-0.2137, 51.5124, -0.1052, 51.5729,
									],
									geometrySource: {
										sourceCrs: "EPSG:4326",
									},
								},
							],
						},
					},
				},
			},
		},
		"400": {
			description:
				"The box is missing or malformed, the geography or release is missing, or `tier` or `limit` is out of range.\n",
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
				"No compiled area release matches the requested geography and release.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"422": {
			description:
				"The geometry collection exceeds the source vertex budget or child count limit. No partial collection is returned. The problem includes links.downloads for the release metadata and its bulk downloads.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/GeometryUnavailable",
		},
	},
} as const;
