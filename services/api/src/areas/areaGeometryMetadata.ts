export const areaGeometryMetadata = {
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
				"The generalisation tier, as the side in metres of the smallest square of detail kept: `full` (every vertex), `high` (10 m), `medium` (100 m), `low` (1000 m).\n",
		},
	],
	operationId: "getAreaGeometry",
	tags: ["Map"],
	summary: "Get one compiled area's raw geometry as a GeoJSON Feature",
	"x-likely-refusal": {
		status: 404,
		code: "area_not_in_release",
		when: "The code is real but not in this release. `presentIn` lists the releases that hold it.",
		"x-example-request": "/v1/areas/ward/2016-12-gb-bgc/E05013830/geometry",
	},
	description:
		"Serves the area's own geometry from its raw, cached source GeoJSON, not a generalised or simplified derivative, always in WGS84. A source in British National Grid (EPSG:27700) is reprojected per area through EPSG:1314, OSGB36 to WGS 84 (6), a Helmert transformation EPSG states as accurate to 2 m in Great Britain; `properties.geometrySource` records the source CRS and any transformation applied. Northern Ireland areas in the releases that declare `northern-ireland-offset` are first moved by that correction, which the ONS's grid files need there, and `geometrySource.corrections` names it when applied. A code that maps to more than one feature fragment in the source (e.g. an area split across islands) is returned as a single GeometryCollection rather than picking one fragment. Coordinates keep seven decimal places of a degree, about a centimetre; most publishers' WGS84 files carry fifteen, which is float noise from their own reprojection. A few areas whose parts lie less than a centimetre apart keep their source precision, because rounding would make their valid boundary invalid.\n\n`tier` generalises the geometry before it is served, for callers that do not need every vertex: Highland is 45,124 of them. A tier is the side of the smallest square of detail kept, and the rule is Visvalingam-Whyatt, dropping the vertex whose triangle with its neighbours is smallest until none below the tier's threshold remains. Triangles are measured in the EPSG:6933 equal-area projection, so a tier means the same thing anywhere in the country. A part or hole smaller than the threshold is dropped whole rather than left as a triangle, and `properties.generalisation` reports the vertex and part counts both before and after.\n\nA tier bounds the size of feature dropped; it does not promise that no vertex moves further than its tolerance, since the same deviation spans a larger triangle the further apart its neighbours lie. Each area is generalised on its own, so above `full` two neighbours drawn together may disagree along the border they share. Ask for `full` where borders must meet exactly. This is still per-request simplification, not the vector tiles the full proposal describes.\n",
	responses: {
		"200": {
			description: "The matching area as a GeoJSON Feature.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/AreaGeometryEnvelope",
					},
					"x-example-request":
						"/v1/areas/constituency/2024-07-uk-bgc/E14001262/geometry",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:24a500c55416bd7d58c28b1fc8cc4931d4a2fd831addafa3116556a91f2c4857",
						data: {
							type: "Feature",
							id: "constituency/2024-07-uk-bgc/E14001262",
							properties: {
								id: "constituency/2024-07-uk-bgc/E14001262",
								geography: "constituency",
								boundaryRelease: "2024-07-uk-bgc",
								code: "E14001262",
								name: "Halifax",
								generalisation: {
									tier: "full",
									toleranceM: 0,
									minEffectiveAreaM2: 0,
									vertices: 1204,
									verticesAtFullResolution: 1204,
									parts: 1,
									partsAtFullResolution: 1,
								},
								geometrySource: {
									sourceCrs: "EPSG:4326",
								},
							},
							geometry: {
								type: "Polygon",
								coordinates: [
									[
										[-1.9269, 53.7874],
										[-1.9146, 53.7815],
									],
								],
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
				"Either no compiled area matches that identity, the area exists but no feature for its code was found in the raw geometry source, or every part of it is smaller than the requested tier keeps.\n",
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
