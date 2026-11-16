export const locationParentsMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/LocationId",
		},
		{
			name: "geography",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"The coarser geography to find parents in, such as `region`.",
		},
		{
			name: "release",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description: "The boundary release of that geography.",
		},
		{
			name: "via",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"The published crosswalk from the location's declared `memberGeography` to that geography. Omit it to be told which are available.\n",
		},
	],
	operationId: "getNamedLocationParents",
	tags: ["Geography"],
	summary:
		"Find the areas of a coarser geography a named location covers or meets",
	"x-likely-refusal": {
		status: 400,
		when: "`geography` is given without `release`.",
		"x-example-request":
			"/v1/locations/north-west/parents?geography=localAuthority",
	},
	description:
		"The other direction from `members`: which regions, counties, combined authorities or countries a location lies in, and whether it takes in each one whole. A location is defined by codes in its declared `memberGeography`, so a parent geography is reached through a published crosswalk out of that geography, named with `via`; asking without it lists the crosswalks published for that geography and release.\n\nEach parent's `relation` is `covers` when the location takes in all of it and `intersects` when it takes in only part. Through a containment or membership lookup that is decided by count, and `parentMemberCount` says how many authorities the publisher places in the parent. Through an area-overlap crosswalk it is decided by area, and `coveredShare` is the share of the parent the location's members cover, with 0.99 or more counting as cover. `members` lists the location's own authorities in each parent.\n\n`locationWithin` names the single parent holding every member, and is null when the members fall in several parents or the crosswalk places any of them in none. Those are listed in `unplaced`: a Welsh authority under an English region lookup, or a district outside every combined authority. `coverage` classifies the location's codes against the authority release the crosswalk starts from, exactly as on `members`.\n\nEvery answer is compiled in advance for each location and crosswalk, so this reads a projection rather than walking a crosswalk per request.\n",
	responses: {
		"200": {
			description:
				"The parents the location covers or meets, and any members placed in none.",
			content: {
				"application/json": {
					schema: {
						type: "object",
					},
					"x-example-request":
						"/v1/locations/greater-manchester/parents?geography=combinedAuthority&release=2025-12-en-bgc&via=local-authority-2025-12-uk-bgc-to-combined-authority-2025-12-en-bgc-official-lookup",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							geography: "combinedAuthority",
							boundaryRelease: "2025-12-en-bgc",
							via: {
								id: "local-authority-2025-12-uk-bgc-to-combined-authority-2025-12-en-bgc-official-lookup",
								method: "clean-containment",
								quality: "publisher-supplied",
							},
							memberGeography: "localAuthority",
							memberBoundaryRelease: "2025-12-uk-bgc",
							locationWithin: {
								id: "combinedAuthority/2025-12-en-bgc/E47000001",
								code: "E47000001",
								name: "Greater Manchester",
							},
							parents: [
								{
									id: "combinedAuthority/2025-12-en-bgc/E47000001",
									code: "E47000001",
									name: "Greater Manchester",
									relation: "covers",
									members: [
										{
											id: "localAuthority/2025-12-uk-bgc/E08000003",
											code: "E08000003",
											name: "Manchester",
										},
									],
									parentMemberCount: 10,
								},
							],
							unplaced: [],
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
				"`geography` or `release` is missing, or `via` is not given; the detail lists the crosswalks published for that geography and release.\n",
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
