export const compareBoundaryMetadata = {
	operationId: "compareBoundaryReleases",
	tags: ["Geography"],
	summary:
		"Compare two releases of one geography without inferring geography change from codes",
	"x-likely-refusal": {
		status: 400,
		when: "One of geography, from or to is omitted, or from and to name the same release.",
		"x-example-request":
			"/v1/boundary-releases:compare?geography=ward&from=2023-05-uk-bgc",
	},
	description:
		"Compares the two compiled code sets, with identifiers present in only one release kept distinct from a claim that an area was added or removed. Shared codes are called continuous only where a published extent-continuity crosswalk measured their geometry. A code only one release holds is listed under `continuity.recoded` where that crosswalk found the same extent under a new code in the other. Its changed, indeterminate and unmeasured findings remain review evidence, not conversion claims. Other published crosswalks between the releases are named separately with their directional code cardinality and bounded split/merge-shaped examples. These describe published records, not a legal boundary-change finding, and need no runtime polygon comparison.\n",
	parameters: [
		{
			name: "geography",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description: "The shared geography family of both releases.",
		},
		{
			name: "from",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description: "The earlier or source release id.",
		},
		{
			name: "to",
			in: "query",
			required: true,
			schema: {
				type: "string",
			},
			description: "The later or target release id.",
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
			description:
				"Maximum sample identifiers or continuity findings in each bounded list.",
		},
	],
	responses: {
		"200": {
			description:
				"Release-level code, continuity and crosswalk evidence.",
			content: {
				"application/json": {
					"x-example-request":
						"/v1/boundary-releases:compare?geography=ward&from=2023-05-uk-bgc&to=2024-12-uk-bgc",
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
