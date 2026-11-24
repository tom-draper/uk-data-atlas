export const atlasPageMetadata = {
	parameters: [
		{
			name: "page-id",
			in: "path",
			required: true,
			schema: {
				type: "string",
				pattern: "^[A-Za-z0-9-]+$",
				description: "A page id, without the .json suffix.",
			},
		},
	],
	operationId: "getAtlasPage",
	tags: ["Geography"],
	summary: "Download a website place profile or catalogue artifact",
	"x-likely-refusal": {
		status: 404,
		when: "The page id is not published.",
		"x-example-request": "/v1/atlas-pages/unknown.json",
	},
	description:
		"API-built website artifacts. Available ids include `places-index`, `places-area-{shard}`, `places-named-{id}`, `place-facts`, `place-trends`, `ward-areas` and `docs-catalogue`. These shapes follow the website and may change with it. Use the area and catalogue routes for stable domain responses.\n",
	responses: {
		"200": {
			description: "The exact JSON build artifact.",
			content: {
				"application/json": {
					"x-example-request": "/v1/atlas-pages/places-index.json",
					schema: {
						type: "object",
					},
				},
			},
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
