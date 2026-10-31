export const boundaryReleasesMetadata = {
	operationId: "listBoundaryReleases",
	tags: ["Geography"],
	summary: "List every compiled boundary release",
	"x-likely-refusal": {
		when: "Takes no input, so nothing is refused but the server-wide rate limit.",
	},
	responses: {
		"200": {
			description: "The full boundary registry.",
			content: {
				"application/json": {
					"x-example-request": "/v1/boundary-releases",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: [
							{
								id: "2025-12-en-bgc",
								geography: "combinedAuthority",
								title: "Combined authorities, December 2025 (England, generalised, clipped)",
								description:
									"English combined authorities and combined county authorities. ONS reports some local area statistics against these, including the life expectancy series held here.",
								temporalCoverage: "2025",
								coverage: {
									countries: ["GB-ENG"],
								},
								source: {
									publisher: "Office for National Statistics",
									url: "https://geoportal.statistics.gov.uk/",
									retrievedAt: "2026-09-06",
									licence: {
										name: "Open Government Licence v3.0",
										url: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
									},
								},
								metadataHash:
									"sha256:6674a5e354661262ca18eebe9667e39774396aa2794caf8e954bd2a2e6b05e50",
							},
						],
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
	},
} as const;
