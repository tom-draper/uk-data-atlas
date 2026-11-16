export const areaValidateMetadata = {
	parameters: [
		{
			name: "geography",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"The geography of the boundary release to validate. Supply with `release`, or omit both to infer a likely compiled release.\n",
		},
		{
			name: "release",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"An exact boundary release id. Supply with `geography`, or omit both to infer a likely compiled release.\n",
		},
		{
			name: "value",
			in: "query",
			required: true,
			schema: {
				type: "array",
				maxItems: 500,
				items: {
					type: "string",
				},
			},
			description:
				"A code or name to validate. Repeatable, in input order.",
		},
		{
			name: "parent",
			in: "query",
			required: false,
			schema: {
				type: "array",
				maxItems: 500,
				items: {
					type: "string",
				},
			},
			description:
				"A parent code or name for the corresponding value. When supplied, repeat once per value in the same order.",
		},
		{
			name: "format",
			in: "query",
			required: false,
			schema: {
				type: "string",
				enum: ["json", "csv"],
				default: "json",
			},
			description:
				"`json` returns the diagnostic and matching manifest. `csv` downloads its row-preserving report.\n",
		},
	],
	operationId: "validateAreaValues",
	"x-rate-limit-cost": 10,
	tags: ["Geography"],
	summary:
		"Validate a batch of area codes or names, or infer their likely release",
	"x-likely-refusal": {
		status: 400,
		when: "No `value` is given to validate.",
		"x-example-request":
			"/v1/areas:validate?geography=ward&release=2024-12-uk-bgc",
	},
	description:
		'With `geography` and `release`, checks each `value` against one exact boundary release before a caller joins data to it. Omit both to rank compiled geography/releases by exact resolutions and report the likely one; this is a diagnosis, never an automatic join or conversion. Where other releases resolve exactly as many values, the likely one is the newest of them and `likely.tiedWith` names the rest, since the values alone cannot tell them apart. At most 500 values may be sent in one GET; POST the column as JSON or CSV to send more.\nA value shaped like an area code is `valid` when the release holds it. Otherwise it is `superseded` or `not-yet-current` when only older or newer releases of the geography hold it, `absent-from-release` when releases on both sides do, `other-geography` when only another geography holds it, `unknown` when nothing does, and `malformed-code` when it is a letter followed by other than eight digits.\nAny other value is a name. It is `matched` only exactly, through a published alias, or with an administrative title such as "City of" set aside, never by prefix or similarity. A name meaning several areas is `ambiguous` and lists them all; an `unmatched` name lists the other releases of the geography where it does match.\nRepeat `parent` alongside `value` to settle a shared name with a parent code or name. It resolves only when exactly one candidate has a published containment relationship to that parent. Each result says in `normalised` whether the value was trimmed or re-cased to be read, and in `duplicateOf` whether it repeats an earlier value. `summary.joinable` is true only when every value names exactly one area of the release.\nEvery JSON result carries a versioned matching manifest with the Atlas release, exact submitted values and their digest, candidate decision and published-path recommendations. Use `format=csv` to download the same row-preserving result for a local join or audit.\n',
	responses: {
		"200": {
			description:
				"A result for every value, in input order, and a summary.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/Envelope",
					},
					"x-example-request":
						"/v1/areas:validate?geography=localAuthority&release=2025-05-uk-bgc-v2&value=Bristol&value=E07000026",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							geography: "localAuthority",
							boundaryRelease: "2025-05-uk-bgc-v2",
							summary: {
								valueCount: 2,
								byStatus: {
									matched: 1,
									superseded: 1,
								},
								duplicateCount: 0,
								normalisedCount: 0,
								joinable: false,
							},
							values: [
								{
									index: 0,
									value: "Bristol",
									kind: "name",
									status: "matched",
									match: "exact-without-title",
									area: {
										id: "localAuthority/2025-05-uk-bgc-v2/E06000023",
										code: "E06000023",
										name: "Bristol, City of",
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
			$ref: "#/components/responses/InvalidQuery",
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
	},
} as const;
