export const documentMetadata = {
	parameters: [
		{
			name: "document-id",
			in: "path",
			required: true,
			schema: {
				type: "string",
				pattern: "^[a-z0-9-]+$",
				description:
					"A document id from a measure or release's documents links, without the .json suffix.",
			},
		},
	],
	operationId: "getEvidenceDocument",
	"x-likely-refusal": {
		status: 404,
		when: "The document id is not published.",
		"x-example-request": "/v1/documents/unknown.json",
	},
	tags: ["Governance"],
	summary: "Download an immutable build evidence document",
	description:
		"Build artifacts that explain release coverage, reviewed conversion validation and other evidence are published as immutable JSON documents, rather than query endpoints. Available document ids are `analysis-geography-validation`, `corrections`, `geography-health`, `geography-inventory`, `measure-compatibility`, `relationship-candidates`, `relationship-repairs`, `validation-report` and `measure-{measure-id}` for each measure, such as `measure-population`.\n",
	responses: {
		"200": {
			description: "The exact JSON build artifact.",
			content: {
				"application/json": {
					"x-example-request":
						"/v1/documents/geography-inventory.json",
					schema: {
						type: "object",
					},
				},
			},
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
	},
} as const;
