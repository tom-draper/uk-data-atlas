export const locationMembersMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/LocationId",
		},
		{
			name: "geography",
			in: "query",
			schema: {
				type: "string",
			},
			description:
				"The geography to resolve members in. Omit it to use the location's declared `memberGeography`; any other geography requires `via`.\n",
		},
		{
			name: "release",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"The boundary release to resolve members in, which fixes the vintage of the codes returned.\n",
		},
		{
			name: "via",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"The published crosswalk to resolve through, required for any geography other than the location's `memberGeography`. Omit it to be told which are available.\n",
			example:
				"ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment",
		},
		{
			name: "asOf",
			in: "query",
			schema: {
				type: "string",
				format: "date",
			},
			description:
				"Select member codes effective on this date. Date selection is currently available for direct member-code matches only, not a crosswalk projection.\n",
		},
	],
	operationId: "getNamedLocationMembers",
	tags: ["Geography"],
	summary: "Resolve a named location's members in one geography and release",
	"x-likely-refusal": {
		status: 400,
		when: "No `release` is given. Members are resolved in one named release, never the latest by default.",
		"x-example-request": "/v1/locations/north-west/members",
	},
	description:
		"`release` is required because location definitions may include legacy codes. Missing members are returned explicitly; this route never applies an implicit historical conversion. A `coverage` object counts resolved and unresolved members and classifies each unresolved code against the compiled releases of its geography as `superseded`, `not-yet-current`, `absent-from-release` or `unknown`, naming the releases that are the evidence. The classification is relative to the requested release and reports code membership only; it asserts nothing about geometry.\n\nA location declares the geography of its member codes, so asking for that geography matches them directly and `membership` is `direct-code-match`. Any other geography has to be reached through a published crosswalk, named with `via`: the wards of North Wales, the constituencies of Merseyside. Asking without `via` returns a 400 that lists the crosswalks published for that geography and release, so the choice is the caller's and is made from what exists.\n\nWhat membership means depends on the crosswalk named, and the response says which. Through a `clean-containment` crosswalk it is `fully-contained`: the publisher places each area wholly inside one parent, so no area is counted in part. Through an `area-overlap` crosswalk it is `weighted-overlap`: an area straddling the edge of the location carries the `weight` lying inside and is marked `partial`, and `partialMembers` counts them. Shares in two members of the same location are added, so an area split between them is whole and not partial.\n\nEach member names the defining area it was found `through`, and `parentBoundaryRelease` names the release the location's own codes were resolved against, which is the release the crosswalk ends at rather than the one asked for. Each member's `relation` is `within` when the whole area lies inside the location and `partly-within` when only its `weight` does; only the first may be counted whole.\n\n`reach` says which of the location's authorities the crosswalk places any area under. A crosswalk covering fewer countries than the location spans, such as LSOAs for a Scottish city, leaves authorities in `unreached`, and the members under them are missing from the answer rather than absent from the ground.\n",
	responses: {
		"200": {
			description:
				"Resolved members, explicitly unresolved codes, and the coverage that explains each one.\n",
			content: {
				"application/json": {
					schema: {
						type: "object",
					},
					"x-example-request":
						"/v1/locations/north-wales/members?geography=ward&release=2024-12-uk-bgc&via=ward-2024-12-uk-bgc-to-local-authority-2024-12-uk-bgc-clean-containment",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							location: {
								id: "north-wales",
								label: "North Wales",
								kind: "editorial-grouping",
								definitionRevision: 1,
								memberGeography: "localAuthority",
								memberCodes: ["W06000001"],
								validity: {
									from: null,
									to: null,
								},
								bbox: [-4.8],
							},
							geography: "ward",
							boundaryRelease: "2024-12-uk-bgc",
							reach: {
								memberCount: 6,
								reachedCount: 6,
								unreached: [],
								complete: true,
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
			description:
				"`release` is missing, or a geography other than the location's `memberGeography` was asked for without `via`. The detail lists the crosswalks published for that geography and release.\n",
			content: {
				"application/problem+json": {
					schema: {
						$ref: "#/components/schemas/Problem",
					},
				},
			},
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
	},
} as const;
