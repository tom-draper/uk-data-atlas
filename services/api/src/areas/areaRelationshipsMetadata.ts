export const areaRelationshipsMetadata = {
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
	],
	operationId: "getAreaRelationships",
	tags: ["Geography"],
	summary: "Get published relationships for one compiled area",
	"x-likely-refusal": {
		status: 404,
		code: "area_not_in_release",
		when: "The code is real but not in this release. `presentIn` lists the releases that hold it.",
		"x-example-request":
			"/v1/areas/ward/2016-12-gb-bgc/E05013830/relationships",
	},
	description:
		"Returns only relationships from published crosswalks. A clean-containment mapping is represented as within from child to parent and contains in reverse. An official historical lookup is represented as successor from source to target and predecessor in reverse; a one-to-many lookup is split-from on each new area and a many-to-one lookup is merged-from on the new area. An extent-continuity crosswalk is equivalent-to in both directions. An area-overlap mapping is represented as overlaps in both directions, with the shared area and its share of each side.\n",
	responses: {
		"200": {
			description:
				"The area identity and its published relationship edges.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/AreaRelationshipsEnvelope",
					},
					"x-example-request":
						"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E08000025/relationships",
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
