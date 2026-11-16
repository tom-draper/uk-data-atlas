export const relationshipsMetadata = {
	parameters: [
		{
			name: "from",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"The release to discover or convert from, as `{geography}/{release}`.",
		},
		{
			name: "to",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"The release to assess a conversion to, as `{geography}/{release}`.",
		},
		{
			name: "purpose",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["identity", "membership", "apportion"],
				default: "membership",
			},
			description:
				"What the conversion is for, as on `/translations`. Only applies with `to`.\n",
		},
		{
			name: "operation",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: [
					"identity-join",
					"code-translation",
					"containment-aggregation",
					"membership-join",
					"weighted-allocation",
				],
			},
			description:
				"Select the best published path for this intended conversion operation.",
		},
		{
			name: "measure",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Preflight this measure against an exact conversion's relationship purpose. A measure id from `GET /v1/measures`, or one of its aliases, with optional dimension filters such as `offence=burglary`; an old series id returns a 404 naming the measure and members that replace it.",
		},
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/MeasureDataset",
		},
		{
			name: "geography",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
		},
		{
			name: "release",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
		},
		{
			name: "relation",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: [
					"within",
					"contains",
					"successor",
					"predecessor",
					"split-from",
					"merged-from",
					"equivalent-to",
					"overlaps",
				],
			},
		},
		{
			name: "limit",
			in: "query",
			required: false,
			schema: {
				type: "integer",
				minimum: 1,
				maximum: 100,
				default: 25,
			},
		},
	],
	operationId: "queryRelationships",
	tags: ["Geography"],
	summary: "Discover, assess and plan published geography relationships",
	"x-likely-refusal": {
		status: 400,
		when: "A conversion names a release other than as geography/release, or a coverage question omits its geography or release.",
		"x-example-request": "/v1/relationships?from=ward",
	},
	description:
		"The front door for relationship evidence in the boundary archive. Supply `from={geography}/{release}` to discover every published conversion from one exact release. Add `to={geography}/{release}` to assess the paths for a `purpose`, their coverage, trust and permitted operations. Add `operation` to select the best published path for that intended operation, without translating any codes or values.\n\nAlternatively, supply `geography` and `release` to report how fully a release is covered by its published relationships. `relation` limits that report to one relationship kind. These two query shapes are deliberately separate: conversion is directional between exact releases, whereas coverage is an audit of one release's evidence.\n",
	responses: {
		"200": {
			description:
				"Published relationship paths and evidence, a selected conversion plan, or release-level relationship coverage.",
			content: {
				"application/json": {
					schema: {
						type: "object",
					},
					examples: {
						capability: {
							"x-example-request":
								"/v1/relationships?from=ward/2023-05-uk-bgc&to=localAuthority/2023-05-uk-bgc-v2&purpose=membership",
							value: {
								apiVersion: "v1",
								atlasRelease:
									"sha256:7349ddf2d37575a455b9dc82c0cac8007df0a74a49151e0a00516c621e8b3dc7",
								data: {
									from: {
										geography: "ward",
										boundaryRelease: "2023-05-uk-bgc",
									},
									to: {
										geography: "localAuthority",
										boundaryRelease: "2023-05-uk-bgc-v2",
									},
									purpose: "membership",
									status: "available",
									paths: [
										{
											id: "ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment/forward/membership",
											purpose: "membership",
											quality: "publisher-supplied",
											origin: "crosswalk",
											steps: [
												{
													crosswalkId:
														"ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment",
													direction: "forward",
													method: "clean-containment",
													purpose: "membership",
												},
											],
											operations: {
												permitted: [
													"containment-aggregation",
													"membership-join",
												],
												prohibited: [
													"weighted-allocation",
												],
											},
											trust: {
												level: "verified",
											},
											coverage: {
												status: "complete",
												share: 1,
											},
										},
									],
									missingPrerequisites: [],
								},
								meta: {
									nextCursor: null,
								},
							},
						},
						plan: {
							"x-example-request":
								"/v1/relationships?from=ward/2023-05-uk-bgc&to=localAuthority/2023-05-uk-bgc-v2&purpose=membership&operation=containment-aggregation",
							value: {
								apiVersion: "v1",
								atlasRelease:
									"sha256:7349ddf2d37575a455b9dc82c0cac8007df0a74a49151e0a00516c621e8b3dc7",
								data: {
									from: {
										geography: "ward",
										boundaryRelease: "2023-05-uk-bgc",
									},
									to: {
										geography: "localAuthority",
										boundaryRelease: "2023-05-uk-bgc-v2",
									},
									status: "available",
									purpose: "membership",
									operation: "containment-aggregation",
									selectedPath: {
										id: "ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment/forward/membership",
										purpose: "membership",
										quality: "publisher-supplied",
										origin: "crosswalk",
										steps: [
											{
												crosswalkId:
													"ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment",
												direction: "forward",
												method: "clean-containment",
												purpose: "membership",
											},
										],
										operations: {
											permitted: [
												"containment-aggregation",
												"membership-join",
											],
											prohibited: ["weighted-allocation"],
										},
										trust: {
											level: "verified",
										},
										coverage: {
											status: "complete",
											share: 1,
										},
									},
									alternatives: [],
									note: "This plan chooses among published paths only. It does not translate codes, allocate values or treat matching identifiers as proof of geographic continuity.",
								},
								meta: {
									nextCursor: null,
								},
							},
						},
						coverage: {
							"x-example-request":
								"/v1/relationships?geography=ward&release=2023-05-uk-bgc&relation=within",
							value: {
								apiVersion: "v1",
								atlasRelease:
									"sha256:7349ddf2d37575a455b9dc82c0cac8007df0a74a49151e0a00516c621e8b3dc7",
								data: {
									geography: "ward",
									boundaryRelease: "2023-05-uk-bgc",
									relation: "within",
									status: "available",
									areaCount: 8441,
									relatedAreaCount: 8441,
									relationshipCount: 16882,
									byRelation: {
										within: 16882,
									},
									crosswalkIds: [
										"ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment",
									],
									uncoveredAreas: [],
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
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
