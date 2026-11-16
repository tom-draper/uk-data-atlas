export const areasMetadata = {
	parameters: [
		{
			name: "geography",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description: "Restrict results to one geography type.",
		},
		{
			name: "release",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description: "Restrict results to one boundary release.",
		},
		{
			$ref: "#/components/parameters/PageLimit",
		},
		{
			name: "cursor",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Opaque cursor from the previous response's nextCursor.",
		},
	],
	operationId: "listAreas",
	tags: ["Geography"],
	summary: "List compiled area identities",
	"x-likely-refusal": {
		status: 400,
		code: "invalid_cursor",
		when: "The cursor was not issued by this API, or was issued for a different query.",
		"x-example-request": "/v1/areas?cursor=not-a-cursor",
	},
	description:
		"Lists compiled area identities, optionally within one geography or boundary release (or `latest` for the newest unambiguous release), in a stable order with cursor pagination. To find an area by name, code or postcode, use `/places?q=`.\n",
	responses: {
		"200": {
			description: "A cursor-paginated page of matching area identities.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/AreaListEnvelope",
					},
					"x-example-request":
						"/v1/areas?geography=ward&release=2024-12-uk-bgc&limit=1",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: [
							{
								id: "ward/2024-12-uk-bgc/E05000932",
								geography: "ward",
								boundaryRelease: "2024-12-uk-bgc",
								code: "E05000932",
								name: "Ainsdale",
							},
						],
						meta: {
							nextCursor:
								"d2FyZC8yMDI0LTEyLXVrLWJnYy9FMDUwMDA5MzI",
						},
					},
				},
			},
		},
		"400": {
			$ref: "#/components/responses/InvalidQuery",
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
