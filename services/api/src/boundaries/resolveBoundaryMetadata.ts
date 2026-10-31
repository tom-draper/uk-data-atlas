export const resolveBoundaryMetadata = {
	operationId: "resolveBoundaryReleaseForDate",
	tags: ["Geography"],
	summary: "Select the boundary release to use for a date",
	"x-likely-refusal": {
		status: 404,
		code: "no_release_for_date",
		when: "The date is before the earliest release of that geography. The refusal gives the earliest date that resolves.",
		"x-example-request":
			"/v1/boundary-releases:resolve?geography=ward&date=1990-01-01",
	},
	description:
		"Returns the latest release of a geography dated on or before `date` that covers `country` when one is given, as an exact release id rather than a moving `latest` alias. Releases are snapshots dated to a month, so a day narrows nothing, and the answer is the latest snapshot at that date rather than a statement of which boundaries were legally in force.\n`previous` and `next` are the neighbouring releases covering the same country; a change after the selected release shows first in `next`. `sameMonth` is true when the date falls in the release's own month, so a change that month may lie either side of it. `notCovering` lists later releases passed over because they miss the country.\nReleases of the same month are told apart only where one is plainly better: a subset derived from another is set aside for its source, and without `country` a release covering fewer countries is set aside. Each is listed in `setAside` with its reason. A deprecated release is never chosen while its replacement, which is not itself deprecated, is dated on or before the date and covers the country; it is set aside for it. Where no such replacement applies the deprecated release is chosen, and the response carries its `Deprecation` headers. Variants differing in any other way, such as clipping, are a 409 listing each in `choices`.\n",
	parameters: [
		{
			name: "geography",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description: "The geography to resolve a release for, e.g. `ward`.",
		},
		{
			name: "date",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"A calendar date as `YYYY-MM-DD`, or a month as `YYYY-MM`.",
		},
		{
			name: "country",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"],
			},
			description:
				"Restricts the answer to releases covering this country, so a Great Britain release is passed over for Northern Ireland.\n",
		},
	],
	responses: {
		"200": {
			description:
				"The selected release, its neighbours and the basis of the choice.",
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
					"x-example-request":
						"/v1/boundary-releases:resolve?geography=localAuthority&date=2023-06-30",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:a37c82c558874df4611b72cff4e74ddfbf1c587f915d157273cf67a01341b80f",
						data: {
							geography: "localAuthority",
							date: "2023-06-30",
							month: "2023-06",
							selected: {
								id: "2023-05-uk-bgc-v2",
								month: "2023-05",
								title: "Local authority districts, May 2023 (United Kingdom, generalised, clipped, v2)",
								countries: [
									"GB-ENG",
									"GB-NIR",
									"GB-SCT",
									"GB-WLS",
								],
								href: "/v1/boundary-releases/localAuthority/2023-05-uk-bgc-v2",
							},
							sameMonth: false,
							previous: {
								id: "2022-12-uk-bgc-v2",
								month: "2022-12",
								title: "Local authority districts, December 2022 (United Kingdom, generalised, clipped, v2)",
								countries: [
									"GB-ENG",
									"GB-NIR",
									"GB-SCT",
									"GB-WLS",
								],
								href: "/v1/boundary-releases/localAuthority/2022-12-uk-bgc-v2",
							},
							next: {
								id: "2023-12-uk-bgc",
								month: "2023-12",
								title: "Local authority districts, December 2023 (United Kingdom, generalised, clipped)",
								countries: [
									"GB-ENG",
									"GB-NIR",
									"GB-SCT",
									"GB-WLS",
								],
								href: "/v1/boundary-releases/localAuthority/2023-12-uk-bgc",
							},
							setAside: [],
							notCovering: [],
							basis: "latest-release-dated-on-or-before",
							note: "Releases are snapshots dated to a month, so this is the latest snapshot at the date asked for, not a statement of which boundaries were legally in force on it. A change after the selected release shows first in next. When sameMonth is true the date falls in the release's own month, and a change that month may lie either side of it.",
						},
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"404": {
			description:
				"No release can be selected: `code` is `unsupported_geography` for an unknown geography, otherwise `no_release_for_date` with `absence` saying whether the date precedes the first release, no release covers the country, or none is dated to a month.\n",
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
				"Several releases share the selected month and differ in more than coverage; `choices` lists them.\n",
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
