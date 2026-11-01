import { z } from "zod";

export const atlasReleaseArtifact = z.looseObject({
	id: z.string(),
	path: z.string().describe("On-disk path relative to the repository root."),
	contentHash: z.string().describe("SHA-256 of the actual stored bytes."),
});

export const atlasReleaseData = z.looseObject({
	schemaVersion: z.literal(1),
	releaseId: z.string(),
	artifacts: z.array(atlasReleaseArtifact),
});

export const atlasReleaseEnvelope = z.looseObject({
	apiVersion: z.literal("v1"),
	atlasRelease: z.string(),
	meta: z.looseObject({ nextCursor: z.string().nullable() }),
	data: atlasReleaseData,
});

export const atlasRelease = {
	method: "get",
	path: "/atlas-release",
	operationId: "getAtlasRelease",
	tags: ["Sync"],
	summary: "Get the current build manifest",
	"x-likely-refusal": {
		status: 503,
		when: "Takes no input. Refused only when the server was started without the release manifest built.",
	},
	description:
		"Identifies the current build by hashes of atlas.sqlite, boundary PMTiles, and catalogues still served as JSON. Export and map catalogues describe the observation and flat boundary downloads. Paths are relative to the repository root and hashes cover the actual on-disk bytes, including gzip encoding where present. The API retains no earlier builds. JSON intermediates already represented in SQLite are omitted.\n",
	responses: {
		200: {
			description: "The current atlas release manifest.",
			content: {
				"application/json": {
					schema: atlasReleaseEnvelope,
					"x-example-request": "/v1/atlas-release",
					example: {
						apiVersion: "v1",
						atlasRelease:
							"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
						data: {
							schemaVersion: 1,
							releaseId:
								"sha256:5c4aa4529cbfbd5e4c844c55cddba1ef04a7bf76f3eaa085a357fff401af6d0c",
							artifacts: [
								{
									id: "atlas-sqlite",
									path: "data/build/atlas.sqlite",
									contentHash:
										"sha256:6516841abb2149d864316bde871efceafbedeb0e6b681bbab588def86e06e0f2",
								},
							],
						},
					},
				},
			},
		},
		503: { $ref: "#/components/responses/CatalogueUnavailable" },
	},
} as const;
