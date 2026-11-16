export const crosswalkRecordsMetadata = {
	parameters: [
		{
			$ref: "#/components/parameters/CrosswalkId",
		},
		{
			name: "source",
			in: "query",
			required: false,
			schema: {
				type: "string",
			},
			description:
				"Filter to the record whose source code matches exactly. Omit to return a cursor-paginated list. A source lookup returns at most one record and has no next cursor.\n",
		},
		{
			name: "limit",
			in: "query",
			required: false,
			schema: {
				type: "integer",
				minimum: 1,
				maximum: 500,
				default: 100,
			},
			description: "Maximum records to return when source is omitted.",
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
	operationId: "listCrosswalkRecords",
	tags: ["Geography"],
	summary: "List (optionally filtered) records for one crosswalk",
	"x-likely-refusal": {
		status: 404,
		when: "The id is described rather than listed. A crosswalk id names both releases and the method; `/v1/crosswalks` lists them.",
		"x-example-request": "/v1/crosswalks/ward-to-local-authority/records",
	},
	responses: {
		"200": {
			description:
				"One page of matching records, or an empty array if `source` matched nothing. Bulk consumers should prefer downloading the static crosswalk artifact until an export endpoint exists. Records of an `area-overlap` crosswalk also carry each source's area and coverage and each target's weight, overlap area and shares.\n",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/CrosswalkRecordListEnvelope",
					},
					examples: {
						officialLookup: {
							"x-example-request":
								"/v1/crosswalks/constituency-2010-to-2024-official-lookup-v2/records?source=N06000004",
							value: {
								apiVersion: "v1",
								atlasRelease:
									"sha256:9edc254c5d4cd0a90fc5d3b2544e5f64946d6d0e6a8b68860e3aa6f0ac8d0912",
								data: [
									{
										source: {
											code: "N06000004",
											labels: ["Belfast West"],
										},
										targets: [
											{
												code: "N05000002",
												labels: ["Belfast North"],
											},
											{
												code: "N05000003",
												labels: [
													"Belfast South and Mid Down",
												],
											},
											{
												code: "N05000004",
												labels: ["Belfast West"],
											},
											{
												code: "N05000014",
												labels: ["South Antrim"],
											},
										],
									},
								],
								meta: {
									nextCursor: null,
								},
							},
						},
						areaOverlap: {
							"x-example-request":
								"/v1/crosswalks/constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-area-overlap/records?source=E14001067",
							value: {
								apiVersion: "v1",
								atlasRelease:
									"sha256:c51e3f4ef14b77972061b9c8f08a838975d700adba9d2372c5d1bbbe8edd27a2",
								data: [
									{
										source: {
											code: "E14001067",
											labels: ["Arundel and South Downs"],
											areaM2: 835415269,
											coverage: 0.999884,
										},
										targets: [
											{
												code: "E07000224",
												labels: ["Arun"],
												weight: 0.122779,
												overlapAreaM2: 102559824,
												sourceShare: 0.122765,
												targetShare: 0.463915,
											},
											{
												code: "E07000225",
												labels: ["Chichester"],
												weight: 0.614952,
												overlapAreaM2: 513680634,
												sourceShare: 0.614881,
												targetShare: 0.652975,
											},
											{
												code: "E07000227",
												labels: ["Horsham"],
												weight: 0.262269,
												overlapAreaM2: 219077810,
												sourceShare: 0.262238,
												targetShare: 0.413031,
											},
										],
									},
								],
								meta: {
									nextCursor: null,
								},
							},
						},
					},
				},
			},
		},
		"404": {
			$ref: "#/components/responses/NotFound",
		},
	},
} as const;
