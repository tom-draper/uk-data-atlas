export const boundariesMetadata = {
	operationId: "listBoundaries",
	tags: ["Geography"],
	summary: "List boundary types with their latest release",
	"x-likely-refusal": {
		when: "Takes no input, so nothing is refused but the server-wide rate limit.",
	},
	responses: {
		"200": {
			description:
				"One entry per geography type present in the boundary registry.",
			content: {
				"application/json": {
					"x-example-request": "/v1/boundaries",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:9edc254c5d4cd0a90fc5d3b2544e5f64946d6d0e6a8b68860e3aa6f0ac8d0912",
						data: [
							{
								id: "constituency",
								latestRelease: "2024-07-uk-bgc",
								releaseCount: 1,
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
