export const areaChildrenGeometryMetadata = {
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
			description: "The official source code for the parent area.",
		},
		{
			name: "tier",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["full", "high", "medium", "low"],
				default: "full",
			},
			description:
				"The generalisation tier applied to every member, as on the geometry route.\n",
		},
		{
			name: "childGeography",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Which children to draw, as a geography such as `ward` or as `{geography}/{release}`. Required when the area's children are published in more than one geography release, such as a district's wards and its LSOAs, since those overlap one another; the 409 lists the choices.\n",
		},
	],
	operationId: "getAreaChildrenGeometry",
	"x-rate-limit-cost": 10,
	tags: ["Map"],
	summary: "Get every child of an area as one GeoJSON FeatureCollection",
	"x-likely-refusal": {
		status: 409,
		when: "The children are published in several overlapping releases. Choose one with `childGeography` rather than having shapes from different vintages drawn together.",
		"x-example-request":
			"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E06000001/children/geometry",
	},
	description:
		"Returns the geometry of every area a published crosswalk names as contained by this one, as a single FeatureCollection: all the wards in a local authority in one request rather than one request each. Each feature carries its own identity, the crosswalk that places it in the collection, and its geometry provenance.\n\nMembership is a published crosswalk's claim, not a geometric test run at request time, so this returns what the Atlas has published rather than what a point-in-polygon sweep would find. An area with no published containment relationship is a 404, not an empty collection.\n\n`tier` generalises every member, exactly as on the geometry route, and is the reason this endpoint is usable at all for a large authority. The method is reported once for the collection rather than on each member; each member reports only what the tier cost it, so one that lost an island can be told from one that did not. Note the caveat that travels with it: members are generalised one at a time, so above `full` neighbours in the same collection may disagree along a shared border.\n\nA member that is published as a relationship but has no servable geometry is listed in `withoutGeometry` with the reason, rather than being passed over. `collection.members` and `collection.withGeometry` disagreeing is how a caller tells a partial collection from a complete one; the response is still a 200. At most 1,000 children may be requested in one collection. Geometry collections process at most 250,000 source vertices per request, counted before simplification. A larger request returns 422 without a partial collection. Reduce the page size for a box query, omit its tier to retrieve identities, or follow the problem's `links.downloads` to the boundary release metadata and its whole-release downloads.\n",
	responses: {
		"200": {
			description:
				"The children as a FeatureCollection, with any that could not be drawn listed beside it.\n",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/AreaChildrenGeometryEnvelope",
					},
					"x-example-request":
						"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E08000025/children/geometry?tier=low&childGeography=ward",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:24a500c55416bd7d58c28b1fc8cc4931d4a2fd831addafa3116556a91f2c4857",
						data: {
							type: "FeatureCollection",
							id: "localAuthority/2023-05-uk-bgc-v2/E08000025/children",
							parent: {
								id: "localAuthority/2023-05-uk-bgc-v2/E08000025",
								geography: "localAuthority",
								boundaryRelease: "2023-05-uk-bgc-v2",
								code: "E08000025",
								name: "Birmingham",
							},
							collection: {
								members: 69,
								withGeometry: 69,
								vertices: 314,
								tier: "low",
								toleranceM: 1000,
								minEffectiveAreaM2: 1000000,
							},
							withoutGeometry: [],
							features: [
								{
									type: "Feature",
									id: "ward/2023-05-uk-bgc/E05011118",
									properties: {
										id: "ward/2023-05-uk-bgc/E05011118",
										geography: "ward",
										boundaryRelease: "2023-05-uk-bgc",
										code: "E05011118",
										name: "Acocks Green",
										membership: {
											id: "ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment",
											method: "clean-containment",
											quality: "publisher-supplied",
										},
										generalisation: {
											vertices: 5,
											verticesAtFullResolution: 32,
											parts: 1,
											partsAtFullResolution: 1,
										},
										geometrySource: {
											sourceCrs: "EPSG:27700",
											transformation: {
												name: "OSGB36 to WGS 84 (6)",
												epsg: "EPSG:1314",
												accuracyM: 2,
											},
										},
									},
									geometry: {
										type: "Polygon",
										coordinates: [
											[
												[-1.8, 52.44],
												[-1.82, 52.45],
											],
										],
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
		"400": {
			description: "The `tier` requested is not one of the named tiers.",
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
				"Either no compiled area matches that identity, or no published relationship names anything as contained by it.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"409": {
			description:
				"The area's children are published in more than one geography release and `childGeography` does not choose one; `choices` lists them.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"422": {
			description:
				"The geometry collection exceeds the source vertex budget or child count limit. No partial collection is returned. The problem includes links.downloads for the release metadata and its bulk downloads.\n",
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
