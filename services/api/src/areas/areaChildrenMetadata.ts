export const areaChildrenMetadata = {
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
			},
			description:
				"Follow declared containment descendants up to this many hops. Each entry in `descendants` names the area the hop left as `from`, so a multi-hop chain can be read back in order.\n",
		},
		{
			name: "childGeography",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Restrict children to one geography, such as `ward`, or one exact geography/release pair. Without it, the newest child release contemporary with the parent is selected for each geography.\n",
		},
	],
	operationId: "getAreaChildren",
	tags: ["Geography"],
	summary: "List published clean-containment children for an area",
	"x-likely-refusal": {
		status: 404,
		code: "area_not_in_release",
		when: "The code is real but not in this release. `presentIn` lists the releases that hold it.",
		"x-example-request": "/v1/areas/ward/2016-12-gb-bgc/E05013830/children",
	},
	responses: {
		"200": {
			description:
				"The area and its contemporary `contains` relationships. `childSelection` records the filter or default policy used.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/AreaRelationshipsEnvelope",
					},
					"x-example-request":
						"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E08000025/children",
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
									relation: "contains",
									counterpart: {
										id: "ward/2023-05-uk-bgc/E05011118",
										geography: "ward",
										boundaryRelease: "2023-05-uk-bgc",
										code: "E05011118",
										labels: ["Acocks Green"],
									},
									crosswalk: {
										id: "ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment",
										method: "clean-containment",
										quality: "publisher-supplied",
										weighting: {
											status: "not-applicable",
										},
									},
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
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
