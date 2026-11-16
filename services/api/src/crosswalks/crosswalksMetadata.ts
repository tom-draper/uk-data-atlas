export const crosswalksMetadata = {
	operationId: "listCrosswalks",
	tags: ["Geography"],
	summary: "List published crosswalks",
	"x-likely-refusal": {
		status: 503,
		when: "Takes no input. Refused only when the server was started without the crosswalk inventory built.",
	},
	responses: {
		"200": {
			description: "The current crosswalk inventory.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/CrosswalkSummaryListEnvelope",
					},
					"x-example-request": "/v1/crosswalks",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:9edc254c5d4cd0a90fc5d3b2544e5f64946d6d0e6a8b68860e3aa6f0ac8d0912",
						data: [
							{
								id: "constituency-2010-to-2024-official-lookup-v2",
								from: {
									geography: "constituency",
									boundaryRelease: "2019-12-uk-bgc",
								},
								to: {
									geography: "constituency",
									boundaryRelease: "2024-07-uk-bgc",
								},
								method: "official-lookup",
								quality: "publisher-supplied",
								weighting: {
									status: "not-provided",
								},
								recordCount: 650,
								artifact:
									"crosswalks/constituency-2010-to-2024-official-lookup-v2.json",
								contentHash:
									"sha256:cefd706b04545b3a02b75b4d7a88f8240019174412a9444490b09055ece0cc82",
							},
							{
								id: "ward-to-local-authority-2025-05-uk-bgc-v2-clean-containment",
								from: {
									geography: "ward",
									boundaryRelease: "2025-05-uk-bgc-v2",
								},
								to: {
									geography: "localAuthority",
									boundaryRelease: "2025-05-uk-bgc-v2",
								},
								method: "clean-containment",
								quality: "publisher-supplied",
								weighting: {
									status: "not-applicable",
								},
								recordCount: 8405,
								artifact:
									"crosswalks/ward-to-local-authority-2025-05-uk-bgc-v2-clean-containment.json",
								contentHash:
									"sha256:4416aac5cac4b092189ed22665ad149bdd3b370a0dab1b75529993932f51fab3",
							},
							{
								id: "constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-area-overlap",
								from: {
									geography: "constituency",
									boundaryRelease: "2024-07-uk-bgc",
								},
								to: {
									geography: "localAuthority",
									boundaryRelease: "2024-05-uk-bgc",
								},
								method: "area-overlap",
								quality: "derived",
								weighting: {
									status: "provided",
									basis: "area",
									normalisation: "per-source",
								},
								recordCount: 650,
								artifact:
									"crosswalks/constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-area-overlap.json",
								contentHash:
									"sha256:e989fe1713b8239eb60455db37c25a72915e16950591c46256b815b4fbc3aca7",
							},
						],
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
