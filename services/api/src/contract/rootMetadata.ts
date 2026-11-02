export const rootMetadata = {
	operationId: "getRoot",
	tags: ["Start here"],
	summary: "API discovery",
	"x-likely-refusal": {
		when: "Takes no input, so nothing is refused but the server-wide rate limit.",
	},
	description: "Lists the currently implemented resource paths.",
	responses: {
		"200": {
			description: "Discovery document.",
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/RootEnvelope",
					},
					"x-example-request": "/v1",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:9edc254c5d4cd0a90fc5d3b2544e5f64946d6d0e6a8b68860e3aa6f0ac8d0912",
						data: {
							name: "UK Data Atlas API",
							links: [
								"/v1/openapi.yaml",
								"/v1/docs",
								"/v1/boundaries",
								"/v1/map-resources",
								"/v1/map-resources/{geography}/{release}",
								"/v1/map-resources/{geography}/{release}.pmtiles",
								"/v1/map-resources/{geography}/{release}/tiles.json",
								"/v1/map-resources/{geography}/{release}/tiles/{z}/{x}/{y}.mvt",
								"/v1/map-resources/{geography}/{release}/features",
								"/v1/map-resources/{geography}/{release}/join/{measure-id}",
								"/v1/boundary-releases",
								"/v1/boundary-releases:resolve",
								"/v1/boundary-releases/{geography}/{release}",
								"/v1/documents/{document-id}.json",
								"/v1/datasets",
								"/v1/datasets/{dataset-id}",
								"/v1/measures",
								"/v1/measures/{measure-id}",
								"/v1/data/{measure-id}",
								"/v1/data/{measure-id}/series",
								"/v1/data/{measure-id}/rankings",
								"/v1/data/{measure-id}/compare",
								"/v1/areas",
								"/v1/areas/{geography}/{release}/{code}",
								"/v1/areas/{geography}/{release}/{code}/relationships",
								"/v1/areas/{geography}/{release}/{code}/geometry",
								"/v1/crosswalks",
								"/v1/crosswalks/{crosswalk-id}",
								"/v1/crosswalks/{crosswalk-id}/records",
								"/v1/data/{measure-id}/export",
								"/v1/exports",
								"/v1/exports/{export-id}",
								"/v1/atlas-release",
							],
						},
						meta: {
							nextCursor: null,
						},
					},
				},
			},
		},
	},
} as const;
