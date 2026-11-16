export const areaParentsMetadata = {
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
				"Follow declared containment ancestors up to this many hops. Each entry in `ancestors` names the area the hop left as `from`, so a multi-hop chain can be read back in order.\n",
		},
	],
	operationId: "getAreaParents",
	tags: ["Geography"],
	summary: "List published clean-containment parents for an area",
	"x-likely-refusal": {
		status: 404,
		code: "area_not_in_release",
		when: "The code is real but not in this release. `presentIn` lists the releases that hold it.",
		"x-example-request": "/v1/areas/ward/2016-12-gb-bgc/E05013830/parents",
	},
	responses: {
		"200": {
			description: "The area and its `within` relationships.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/AreaRelationshipsEnvelope",
					},
					"x-example-request":
						"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E08000025/parents",
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
							relationships: [],
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
