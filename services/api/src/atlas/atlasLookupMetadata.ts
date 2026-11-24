export const atlasLookupMetadata = {
	parameters: [
		{
			name: "lookup-id",
			in: "path",
			required: true,
			schema: {
				type: "string",
				pattern: "^[a-z0-9-]+$",
				description: "A lookup id, without the .json suffix.",
			},
		},
	],
	operationId: "getAtlasLookup",
	tags: ["Geography"],
	summary: "Download a containment or lineage lookup the atlas reads",
	"x-likely-refusal": {
		status: 404,
		when: "The lookup id is not published.",
		"x-example-request": "/v1/atlas-lookups/unknown.json",
	},
	description:
		"The web atlas cannot hold the crosswalks, so the build reduces them to compact lookups for the boundary releases the atlas draws, as the geography resolver answers them. Available ids are `boundary-mappings` (each ward's local authority and constituency), `constituency-lad-overlaps` (the share of each constituency every local authority holds), `data-zone-lad-mappings` (the data zones of each local authority, for each data zone release), `parish-lad-mappings` and `lsoa-lad-mappings-{year}` for each LSOA year the atlas draws, such as `lsoa-lad-mappings-2021`. Their shapes follow the atlas and may change with it; the crosswalks and relationship routes are the stable way to ask the same questions.\n",
	responses: {
		"200": {
			description: "The exact JSON build artifact.",
			content: {
				"application/json": {
					"x-example-request":
						"/v1/atlas-lookups/boundary-mappings.json",
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
