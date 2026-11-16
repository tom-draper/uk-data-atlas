export const areaOverlapMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/Geography",
		},
		{
			$ref: "#/components/parameters/Release",
		},
		{
			$ref: "#/components/parameters/AreaCode",
		},
		{
			name: "place",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"The other area as `{geography}/{release}/{code}`, such as `localAuthority/2024-05-uk-bgc/E07000092`. Use `latest` as the release for its newest unambiguous published boundary release.\n",
		},
	],
	operationId: "getAreaOverlap",
	"x-rate-limit-cost": 5,
	tags: ["Map"],
	summary: "Measure how one area overlaps another",
	"x-likely-refusal": {
		status: 400,
		when: "No `place` names the other area as `{geography}/{release}/{code}`.",
		"x-example-request":
			"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E06000001/overlap",
	},
	description:
		"Intersects this area with the area named in `place`, which may be of another geography or boundary release, and returns the shared area, each area's share of it, and a relation, so a constituency and a local authority can be compared without downloading either geometry.\nThe relation follows the rules the published area-overlap crosswalks are compiled with, stated in `method`. The intersection is judged by its widest piece: narrower than `sliverWidthM` it is where two independently generalised borders disagree, and the relation is `boundary-only`; within a factor of two of that width it is `indeterminate`, because a crosswalk compile would refuse to decide. Otherwise an area covered to `minimumCoverage` is `within` the other, the other `contains` it, both covered is `same-extent`, and anything else `overlaps`. Areas that do not meet are `disjoint`.\nThis measures the generalised boundaries as published and is not an official statement of how the areas relate. `publishedRelationships` lists any published crosswalk relationship between the two, with its method and quality. The other release may be `latest`; the response records that selection beside the second area.\n",
	responses: {
		"200": {
			description:
				"Both areas, the overlap, its relation and the method.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request":
						"/v1/areas/constituency/2024-07-uk-bgc/E14001063/overlap?place=localAuthority/2024-05-uk-bgc/E07000089",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							first: {
								id: "constituency/2024-07-uk-bgc/E14001063",
								geography: "constituency",
								boundaryRelease: "2024-07-uk-bgc",
								code: "E14001063",
								name: "Aldershot",
								areaM2: 57138472,
								geometry: {
									input: "boundaries/constituency/2024-07-uk-bgc/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC_-8097874740651686118.geojson",
									inputHash:
										"sha256:d3ac7aea554e63864a030baf6b5b2069cb8b1870e16a611ae21df6ad23b04383",
									sourceCrs: "EPSG:4326",
								},
							},
							second: {
								id: "localAuthority/2024-05-uk-bgc/E07000089",
								geography: "localAuthority",
								boundaryRelease: "2024-05-uk-bgc",
								code: "E07000089",
								name: "Hart",
								areaM2: 215399269,
								geometry: {
									input: "boundaries/local-authority/2024-05-uk-bgc/Local_Authority_Districts_May_2024_Boundaries_UK_BGC_-6307115499537197728.geojson",
									inputHash:
										"sha256:a54c16257bac529d380d7f9e9a3449186fda563ee426e565153a08e60d4afa3a",
									sourceCrs: "EPSG:4326",
								},
							},
							relation: "overlaps",
							overlap: {
								areaM2: 18055366,
								shareOfFirst: 0.315993,
								shareOfSecond: 0.083823,
								pieceCount: 1,
								widestPieceWidthM: 1486,
							},
							publishedRelationships: [
								{
									relation: "overlaps",
									crosswalk: {
										id: "constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-area-overlap",
										method: "area-overlap",
										quality: "derived",
										weighting: {
											status: "provided",
											basis: "area",
											normalisation: "per-source",
										},
										href: "/v1/crosswalks/constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-area-overlap",
									},
									overlap: {
										areaM2: 18055366,
										shareOfArea: 0.315993,
										shareOfCounterpart: 0.083823,
									},
								},
							],
							method: {
								sliverWidthM: 100,
								minimumCoverage: 0.99,
								areaProjection: "EPSG:6933",
								clipping: "polygon-clipping@0.15.7",
								area: "Ellipsoidal, through EPSG:6933, an equal-area projection on the WGS 84 ellipsoid, so no correction is applied. A piece's width is twice its area over its perimeter.",
							},
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
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
