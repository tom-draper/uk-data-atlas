export const lookupsMetadata = {
	operationId: "listBulkLookups",
	tags: ["Sync"],
	summary: "List whole lookup tables for download",
	"x-likely-refusal": {
		status: 503,
		when: "Takes no input. Refused only when the server was started without the lookup manifest built.",
	},
	description:
		"Returns every bulk lookup: each boundary release's area identities with their aliases, each crosswalk flattened to one row per source and target (clean-containment crosswalks are the published hierarchy), and named-location membership. Each lists its columns, row count, the published artifact it is rendered from with that artifact's hash, and the byte size and hash of every format, under the Atlas release that pins the manifest.\n",
	responses: {
		"200": {
			description: "The bulk-lookup manifest.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/LookupManifestEnvelope",
					},
					"x-example-request": "/v1/lookups",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:dfa67bf7df94ff5b655985b008aec8f28e235746fe0a15f4ca4853d172621eff",
						data: {
							schemaVersion: 1,
							contentHash:
								"sha256:67f2e1de51b89868fc95bac3156b1f1818b364b4db0977e737be475c9f7b69a3",
							lookups: [
								{
									id: "areas-ward-2024-12-uk-bgc",
									kind: "area-identities",
									title: "Area identities, ward 2024-12-uk-bgc",
									source: {
										artifact:
											"areas/ward/2024-12-uk-bgc.json",
										contentHash:
											"sha256:f82398b92702e504d468d6d9e51fe3bc6ccbb3acea467316e783c427cfb0d360",
									},
									columns: [
										{
											name: "geography",
											type: "string",
											required: true,
											description:
												"The geography the release publishes.",
										},
										{
											name: "boundaryRelease",
											type: "string",
											required: true,
											description:
												"The boundary release.",
										},
										{
											name: "code",
											type: "string",
											required: true,
											description:
												"The official area code.",
										},
										{
											name: "name",
											type: "string",
											required: true,
											description:
												"The area's name in the release.",
										},
										{
											name: "aliases",
											type: "string[]",
											required: false,
											description:
												"Other names the release gives the area, such as a Welsh name.",
										},
									],
									rowCount: 8396,
									formats: {
										csv: {
											contentType:
												"text/csv; charset=utf-8",
											bytes: 392763,
											contentHash:
												"sha256:a1b1055efab8ac2b8c04e89a55a4aad87bba6baeca46e27a7b2f658ee4952ea0",
											href: "/v1/lookups/areas-ward-2024-12-uk-bgc?format=csv",
										},
										ndjson: {
											contentType:
												"application/x-ndjson; charset=utf-8",
											bytes: 947293,
											contentHash:
												"sha256:162c1889dfbccbc8a75db81e6c05c5a5972333e6bf3342a015fe3dd5400162e5",
											href: "/v1/lookups/areas-ward-2024-12-uk-bgc?format=ndjson",
										},
									},
								},
							],
							note: "Each lookup is rendered from the published artifact its source names, and its bytes match the hash listed for the format.",
						},
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
		"503": {
			$ref: "#/components/responses/CatalogueUnavailable",
		},
	},
} as const;
