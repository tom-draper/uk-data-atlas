export const areaMetadata = {
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
			name: "include",
			in: "query",
			required: false,
			schema: {
				type: "array",
				items: {
					type: "string",
					enum: ["dossier", "capabilities", "citation", "metrics"],
				},
			},
			style: "form",
			explode: false,
			description:
				"Optional comma-separated expansions. `dossier` adds boundary evidence, availability and verified-resource links without repeating the area identity; `capabilities`, `citation` and `metrics` are described above.\n",
		},
		{
			name: "measure",
			in: "query",
			required: false,
			schema: {
				type: "array",
				items: {
					type: "string",
				},
			},
			description:
				"With `include=citation`, a measure id from `GET /v1/measures`, or one of its aliases, to cite. Repeatable. Dimension filters such as `offence=burglary` apply to each listed measure that has the dimension; an old series id such as `crime-burglary` returns a 404 naming the measure and members that replace it.\n",
		},
		{
			$ref: "#/components/parameters/Dimensions",
		},
		{
			$ref: "#/components/parameters/MeasureDataset",
		},
		{
			name: "crosswalk",
			in: "query",
			required: false,
			schema: {
				type: "array",
				items: {
					type: "string",
				},
			},
			description:
				"With `include=citation`, a crosswalk id from `GET /crosswalks` to cite. Repeatable.\n",
		},
	],
	operationId: "getArea",
	tags: ["Geography"],
	summary: "Get one compiled area by its full identity",
	description:
		"Where precompiled postcode placements cover this boundary release, the area also includes live and terminated unit-postcode counts from the ONS Postcode Directory edition shown in `postcodes.edition`.\n\n`include` expands the area with any of four reports, each under its own key:\n\n`capabilities` reports geometry, published relationship and crosswalk edges, direct-code named-location membership, and every measure's capability for this exact area, each in the capability vocabulary described by `CapabilityStatus`: `available`, `partial`, `requires-conversion`, `unsupported` or `not-built`, with a `reason` on every status but `available`. A measure is `available` when a source partition published on this release has a value for the area in every period, and `partial` when it has one in only some periods or its codes only partly join the release. It `requires-conversion` when no partition is published on the release but a published crosswalk converts one onto it: each entry in `conversions` names the crosswalk, the source partition and period, and a ready `href` to the convert route. A conversion is only offered after that exact conversion has been run on the source's latest period and accepted, and only if it reaches this area. A measure whose values do not add over areas is never offered a conversion. `capabilities.data.measures` lists the available, partial and convertible measures; `capabilities.data.counts` counts every measure by status, the unsupported ones included. Compatibility is based on area-code membership only and does not assert equal geometry.\n\n`citation` returns what a caller needs to cite the area as served by this Atlas release: the immutable Atlas release, the content hash of the area identity artifact, the boundary release's publisher, licence and metadata hash, geometry provenance, the validation results for the release and any cited crosswalk, and an attribution block. Name a `measure` to cite the observation artifacts, with their content hashes, that hold a value for this area in a source partition assessed against this exact boundary release. Only those partitions' datasets are attributed, together with any dataset a derived measure is calculated from. Name a `crosswalk` to cite one that publishes a relationship for this area. A resource that supplies nothing for the area is refused with `422` rather than cited. The citation hashes the whole geometry source file; `include=metrics` supplies the per-area `geometryHash`. The boundary release's `metadataHash` pins its metadata, which names the source file but does not hash its contents. The envelope's top-level `atlasRelease` is the release of the API response itself: use `citation.identity.contentHash` for the compiled area identity, `citation.boundary.metadataHash` for the boundary metadata, and the hashes under `citation.measures`, `citation.crosswalks` and `citation.geometry` for the other artifacts that support a cited result.\n\n`metrics` measures the area's geometry without transferring its coordinates: its bounding box, centroid, label point, area and perimeter. The same source, reprojection and declared grid corrections apply as for the geometry itself, and `metrics.geometrySource` records them. Area is ellipsoidal, taken through EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global), a Lambert cylindrical equal-area projection on the WGS 84 ellipsoid, so projected area is area on the ellipsoid and no correction is applied; holes are subtracted. Perimeter sums every ring, holes included, each edge's ground length coming from the ellipsoid's radii of curvature at its mid-latitude. The centroid is the centre of area in that same projection, inverted back to WGS 84. `labelPoint` is guaranteed to lie inside the geometry: the centroid where that falls within the area, otherwise the midpoint of the widest run of interior found on latitudes sampled across the bounding box; `labelPointMethod` says which was used. These figures describe the boundary as that release publishes it, at its own generalisation. They are not a published land-area statistic: a coastline-clipped boundary still encloses inland water, so they differ from the ONS Standard Area Measurement that `population-density` uses as its denominator. The `method` block repeats this with every response. An area whose geometry carries no polygon to measure, such as a release held only as points, is refused with `422` rather than measured as zero. `geometrySource.validity` carries the build-time validity report for the full WGS84 geometry. Invalid geometry is not repaired; measurements from it may be unreliable. An unmeasurable geometry's `422` response also carries `geometrySource` and its report. If measurement throws after geometry is loaded, the `503` problem retains that provenance and report too.\n",
	"x-likely-refusal": {
		status: 404,
		code: "area_not_in_release",
		when: "The code is real but not in this release. `presentIn` lists the releases that hold it.",
		"x-example-request": "/v1/areas/ward/2016-12-gb-bgc/E05013830",
	},
	responses: {
		"200": {
			description: "The matching compiled area.",
			headers: {
				Deprecation: {
					$ref: "#/components/headers/ReleaseDeprecation",
				},
				Sunset: {
					$ref: "#/components/headers/ReleaseSunset",
				},
				Link: {
					$ref: "#/components/headers/ReleaseSuccessorLink",
				},
			},
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/AreaEnvelope",
					},
					"x-example-request":
						"/v1/areas/constituency/2024-07-uk-bgc/E14001262",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:9edc254c5d4cd0a90fc5d3b2544e5f64946d6d0e6a8b68860e3aa6f0ac8d0912",
						data: {
							id: "constituency/2024-07-uk-bgc/E14001262",
							geography: "constituency",
							boundaryRelease: "2024-07-uk-bgc",
							code: "E14001262",
							name: "Halifax",
							postcodes: {
								live: 3412,
								terminated: 1412,
								largeUser: 123,
								edition: "2026-08",
							},
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
		"422": {
			description:
				"With `include=citation`, a named measure holds no observation for this area in a source assessed against this boundary release, or a named crosswalk publishes no relationship for it. With `include=metrics`, the area's geometry carries no polygon to measure.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"503": {
			description:
				"An `include` needs an artifact this deployment has not built: the data catalogue and crosswalk inventory for `citation`, or geometry for `metrics`.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
	},
} as const;
