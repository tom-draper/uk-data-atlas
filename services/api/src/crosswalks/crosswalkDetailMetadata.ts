export const crosswalkDetailMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/CrosswalkId",
		},
	],
	operationId: "getCrosswalk",
	tags: ["Geography"],
	summary: "Get one crosswalk's metadata",
	"x-likely-refusal": {
		status: 404,
		when: "The id is described rather than listed. A crosswalk id names both releases and the method; `/v1/crosswalks` lists them.",
		"x-example-request": "/v1/crosswalks/ward-to-local-authority",
	},
	description:
		"Returns the crosswalk's method, quality, weighting, endpoints, provenance and validation facts, but not its full record set. Fetch `/crosswalks/{crosswalk-id}/records` for the mappings themselves.\n",
	responses: {
		"200": {
			description: "The matching crosswalk's metadata.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/CrosswalkMetadataEnvelope",
					},
					examples: {
						officialLookup: {
							"x-example-request":
								"/v1/crosswalks/constituency-2010-to-2024-official-lookup-v2",
							value: {
								apiVersion: "v1",
								atlasRelease:
									"sha256:9edc254c5d4cd0a90fc5d3b2544e5f64946d6d0e6a8b68860e3aa6f0ac8d0912",
								data: {
									schemaVersion: 1,
									contentHash:
										"sha256:cefd706b04545b3a02b75b4d7a88f8240019174412a9444490b09055ece0cc82",
									id: "constituency-2010-to-2024-official-lookup-v2",
									method: "official-lookup",
									quality: "publisher-supplied",
									weighting: {
										status: "not-provided",
									},
									from: {
										geography: "constituency",
										boundaryRelease: "2019-12-uk-bgc",
									},
									to: {
										geography: "constituency",
										boundaryRelease: "2024-07-uk-bgc",
									},
									provenance: {
										input: "boundaries/constituency/2024-07-uk-bgc/Westminster_PCON_(2010)_to_future_Westminster_PCON_(2024)_Lookup_in_the_UK_(V2).geojson",
										inputHash:
											"sha256:62e1ac00a3a6cce21055d623e7141e814e7212014a37fab0b0a3d693cf0e82a3",
									},
									validation: {
										sourceNameConflicts: [
											{
												code: "N06000004",
												names: [
													"Belfast North",
													"Belfast West",
												],
											},
										],
										endpoints: {
											from: {
												status: "verified",
												availableAreaCount: 650,
												referencedCodeCount: 650,
											},
											to: {
												status: "verified",
												availableAreaCount: 650,
												referencedCodeCount: 650,
											},
										},
									},
								},
								meta: {
									nextCursor: null,
								},
							},
						},
						areaOverlap: {
							"x-example-request":
								"/v1/crosswalks/constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-area-overlap",
							value: {
								apiVersion: "v1",
								atlasRelease:
									"sha256:c51e3f4ef14b77972061b9c8f08a838975d700adba9d2372c5d1bbbe8edd27a2",
								data: {
									schemaVersion: 1,
									id: "constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-area-overlap",
									method: "area-overlap",
									quality: "derived",
									weighting: {
										status: "provided",
										basis: "area",
										normalisation: "per-source",
									},
									from: {
										geography: "constituency",
										boundaryRelease: "2024-07-uk-bgc",
									},
									to: {
										geography: "localAuthority",
										boundaryRelease: "2024-05-uk-bgc",
									},
									provenance: {
										inputs: [
											{
												side: "from",
												input: "boundaries/constituency/2024-07-uk-bgc/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC_-8097874740651686118.geojson",
												inputHash:
													"sha256:d3ac7aea554e63864a030baf6b5b2069cb8b1870e16a611ae21df6ad23b04383",
											},
											{
												side: "to",
												input: "boundaries/local-authority/2024-05-uk-bgc/Local_Authority_Districts_May_2024_Boundaries_UK_BGC_-6307115499537197728.geojson",
												inputHash:
													"sha256:a54c16257bac529d380d7f9e9a3449186fda563ee426e565153a08e60d4afa3a",
											},
										],
										areaProjection: "EPSG:6933",
										clipping: "polygon-clipping@0.15.7",
									},
									validation: {
										sourceNameConflicts: [],
										endpoints: {
											from: {
												status: "verified",
												availableAreaCount: 650,
												referencedCodeCount: 650,
											},
											to: {
												status: "verified",
												availableAreaCount: 361,
												referencedCodeCount: 361,
											},
										},
										overlap: {
											candidatePairCount: 3600,
											intersectingPairCount: 2329,
											sliverPairCount: 1381,
											sliverWidthM: 100,
											widestSliverWidthM: 15.1,
											narrowestOverlapWidthM: 332.1,
											minimumCoverage: 0.99,
											minimumSourceCoverage: 0.99606,
											minimumTargetCoverage: 0.997111,
										},
									},
									contentHash:
										"sha256:e989fe1713b8239eb60455db37c25a72915e16950591c46256b815b4fbc3aca7",
								},
								meta: {
									nextCursor: null,
								},
							},
						},
					},
				},
			},
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
	},
} as const;
