export const areaHistoryMetadata = {
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
			name: "depth",
			in: "query",
			required: false,
			schema: {
				type: "integer",
				minimum: 1,
				maximum: 20,
				default: 8,
			},
			description:
				"Maximum number of declared historical edges to follow.",
		},
	],
	operationId: "getAreaHistory",
	tags: ["Geography"],
	summary:
		"Explain a code's published historical relationships and same-code continuity",
	"x-likely-refusal": {
		status: 404,
		code: "area_not_in_release",
		when: "The code is real but not in this release. `presentIn` lists the releases that hold it.",
		"x-example-request": "/v1/areas/ward/2016-12-gb-bgc/E05013830/history",
	},
	description:
		"Returns a bounded traversal of published historical relationships plus every other release of the same geography that contains the same code. Each lineage entry names the area the walk stood on as `from` and the area it reached as `counterpart`. A link a crosswalk publishes from both ends is one edge and is reported once, whichever end the walk reaches it from. Same-code continuity is not evidence of unchanged geometry or a one-to-one historical equivalent.\n",
	responses: {
		"200": {
			description:
				"Area history, including a warning about same-code continuity.",
			content: {
				"application/json": {
					schema: {
						type: "object",
					},
					"x-example-request":
						"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E08000025/history",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							id: "localAuthority/2023-05-uk-bgc-v2/E08000025",
							geography: "localAuthority",
							boundaryRelease: "2023-05-uk-bgc-v2",
							code: "E08000025",
							name: "Birmingham",
							relationships: [
								{
									relation: "predecessor",
									counterpart: {
										id: "localAuthority/2022-12-uk-bgc-v2/E08000025",
										geography: "localAuthority",
										boundaryRelease: "2022-12-uk-bgc-v2",
										code: "E08000025",
										labels: ["Birmingham"],
									},
									crosswalk: {
										id: "local-authority-2022-12-uk-bgc-v2-to-2023-05-uk-bgc-v2-official-lookup",
										method: "official-lookup",
										quality: "publisher-supplied",
										weighting: {
											status: "not-provided",
										},
									},
								},
							],
							lineage: [
								{
									relation: "predecessor",
									depth: 1,
									from: "localAuthority/2023-05-uk-bgc-v2/E08000025",
									counterpart: {
										id: "localAuthority/2022-12-uk-bgc-v2/E08000025",
									},
								},
							],
							sameCodeReleases: [
								{
									id: "localAuthority/2016-12-gb-bgc/E08000025",
									geography: "localAuthority",
									boundaryRelease: "2016-12-gb-bgc",
									code: "E08000025",
									name: "Birmingham",
									status: "same-code-continuity",
								},
							],
							note: "Lineage follows only published historical edges and never infers a connection from a reused code. equivalent-to is published only for extent continuity. Same-code continuity only reports that the identifier appears in another release; it does not assert unchanged geometry or an exact historical equivalent.",
						},
						meta: {
							nextCursor: null,
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
