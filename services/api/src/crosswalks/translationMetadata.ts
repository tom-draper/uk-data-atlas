export const translationMetadata = {
	parameters: [
		{
			name: "from",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"The code's exact source release, as `{geography}/{release}`.",
		},
		{
			name: "code",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"The area code to translate, as published in `from`.\n",
		},
		{
			name: "to",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description:
				"The exact target release, as `{geography}/{release}`.",
		},
		{
			name: "purpose",
			in: "query",
			schema: {
				type: "string",
				enum: ["identity", "membership", "apportion"],
				default: "membership",
			},
			description:
				"What the translation is for: official historical `identity`, clean `membership`, or area-overlap `apportion`. A crosswalk is used only where its method suits the purpose.\n",
		},
	],
	operationId: "translateAreaCode",
	tags: ["Geography"],
	summary:
		"Translate one code through a published conversion path in either direction",
	"x-likely-refusal": {
		status: 422,
		when: "No crosswalk is published for this source, target and purpose. A shared code is never taken as proof of the same area.",
		"x-example-request":
			"/v1/translations?from=ward/2023-05-uk-bgc&code=E05000932&to=constituency/2024-07-uk-bgc",
	},
	description:
		"`identity` permits publisher-supplied historical lookups only, `membership` permits clean containment only, and `apportion` permits area-overlap crosswalks only. The resolver selects every published path with that purpose, ranking direct paths before reviewed and then discovered compositions. `paths` records every step used. A direct result retains its directional crosswalk and provenance; a composed result carries its full `path` instead, so it cannot be mistaken for a direct lookup. A composed result's targets carry only their code, labels and, for `apportion`, the weight multiplied along the path: a step's shares, overlap area and population describe the areas that step joins, not the queried one. Reverse area-overlap weights are normalised against the queried target and report its source coverage. A composed apportion result retains that first-step `sourceCoverage` and reports `resolvedCoverage`, the share of the queried source its final targets represent. The route does not treat a shared code across releases as proof of unchanged geography.\n",
	responses: {
		"200": {
			description: "Matching published crosswalk records.",
			content: {
				"application/json": {
					schema: {
						type: "object",
					},
					"x-example-request":
						"/v1/translations?from=ward/2024-12-uk-bgc&code=E05000932&to=localAuthority/2024-12-uk-bgc&purpose=membership",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							source: {
								geography: "ward",
								boundaryRelease: "2024-12-uk-bgc",
								code: "E05000932",
							},
							target: {
								geography: "localAuthority",
								boundaryRelease: "2024-12-uk-bgc",
							},
							purpose: "membership",
							paths: [
								{
									id: "ward-2024-12-uk-bgc-to-local-authority-2024-12-uk-bgc-clean-containment/forward/membership",
									purpose: "membership",
									from: {
										geography: "ward",
										boundaryRelease: "2024-12-uk-bgc",
									},
									to: {
										geography: "localAuthority",
										boundaryRelease: "2024-12-uk-bgc",
									},
									quality: "publisher-supplied",
									origin: "crosswalk",
									steps: [
										{
											crosswalkId:
												"ward-2024-12-uk-bgc-to-local-authority-2024-12-uk-bgc-clean-containment",
											direction: "forward",
											method: "clean-containment",
											purpose: "membership",
										},
									],
								},
							],
							matches: [
								{
									crosswalk: {
										id: "ward-2024-12-uk-bgc-to-local-authority-2024-12-uk-bgc-clean-containment",
										method: "clean-containment",
										quality: "publisher-supplied",
										weighting: {
											status: "not-applicable",
										},
										provenance: {
											input: "boundaries/ward/2024-12-uk-bgc/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson",
											inputHash:
												"sha256:8d74542cadd4da4801c5ed0f6db1a3eb4437327cdd7b77030c4fbcf01e0d9177",
										},
										direction: "forward",
									},
									source: {
										code: "E05000932",
										labels: ["Ainsdale"],
									},
									targets: [
										{
											code: "E08000014",
											labels: ["Sefton"],
										},
									],
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
		"422": {
			description:
				"No published conversion supports the requested purpose.",
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
