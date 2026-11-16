export const areaNeighboursMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Geography",
		},
		{
			$ref: "#/components/parameters/Release",
		},
		{
			name: "code",
			in: "path",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"The official source code for this area on this boundary release.",
		},
		{
			name: "touches",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["edge", "any"],
				default: "edge",
			},
			description:
				"`edge` for areas sharing a border with length; `any` to include areas meeting only at a point.\n",
		},
	],
	operationId: "getAreaNeighbours",
	"x-rate-limit-cost": 5,
	tags: ["Map"],
	summary: "List the areas whose boundary meets this one's",
	"x-likely-refusal": {
		status: 404,
		code: "area_not_in_release",
		when: "The code is real but not in this release. `presentIn` lists the releases that hold it.",
		"x-example-request":
			"/v1/areas/ward/2016-12-gb-bgc/E05013830/neighbours",
	},
	description:
		'Returns the areas next to this one within the same geography and release, each with the length of the border they share. This supports local comparison, map navigation and spatial modelling: "how does this ward compare with the ones around it" needs to know which those are.\n\nNeighbours are found from shared vertices, not from a distance threshold. Adjacent areas in one published release are drawn from the same vertices, so a common border is the same coordinates on both sides and matches exactly; the shared length is summed over those edges, each counted once, with ground length from the ellipsoid\'s radii of curvature. Nobody picks a tolerance, and nothing is approximate.\n\n`touches` decides whether areas meeting at a single point count. `edge`, the default, returns only areas sharing a border with length; `any` also returns those meeting at a corner, whose `sharedBorderM` is zero. Four areas at a crossroads are not neighbours of each other in any sense useful for comparison or for colouring a map, so they are excluded unless asked for; `border.pointOnlyTouches` counts them either way, so their exclusion is visible rather than silent. They are real: none occur between local authorities, while about 3% of ward adjacencies are corners.\n\n`border` totals the perimeter, the border shared with the neighbours returned, and the remainder. For a landlocked area the remainder is nothing; otherwise it is coastline, a national boundary, or a border with an area outside this release. Birmingham shares 100% of its perimeter across seven neighbours; the Isle of Wight has none, and all 188.7 km of its boundary is its own.\n\nWithin one geography and release only. Two areas that genuinely touch on the ground but were drawn from different vertices are not found, which is why this is not offered across releases.\n',
	responses: {
		"200": {
			description:
				"The neighbouring areas, ordered by shared border, longest first.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/AreaNeighboursEnvelope",
					},
					"x-example-request":
						"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E08000025/neighbours",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:24a500c55416bd7d58c28b1fc8cc4931d4a2fd831addafa3116556a91f2c4857",
						data: {
							id: "localAuthority/2023-05-uk-bgc-v2/E08000025",
							geography: "localAuthority",
							boundaryRelease: "2023-05-uk-bgc-v2",
							code: "E08000025",
							name: "Birmingham",
							touches: "edge",
							border: {
								perimeterM: 104147.22,
								sharedBorderM: 104147.22,
								unsharedBorderM: 0,
								pointOnlyTouches: 0,
							},
							neighbours: [
								{
									id: "localAuthority/2023-05-uk-bgc-v2/E08000029",
									code: "E08000029",
									name: "Solihull",
									touch: "edge",
									sharedBorderM: 26694.1,
									shareOfPerimeter: 0.2563,
									sharedEdges: 153,
									sharedVertices: 154,
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
			description: "`touches` is neither `edge` nor `any`.",
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
				"Either no compiled area matches that identity, or the area exists but no feature for its code was found in the raw geometry source.\n",
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
