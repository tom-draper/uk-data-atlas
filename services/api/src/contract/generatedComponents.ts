import { z } from "zod";
import { atlasReleaseArtifact, atlasReleaseData } from "./atlasRelease";

export const generatedComponents = () => {
	const artifact = z.toJSONSchema(atlasReleaseArtifact);
	const release = z.toJSONSchema(atlasReleaseData);
	const {
		$schema: _artifactSchema,
		additionalProperties: _artifactExtra,
		...artifactSchema
	} = artifact;
	const {
		$schema: _releaseSchema,
		additionalProperties: _releaseExtra,
		...releaseSchema
	} = release;
	const properties = releaseSchema.properties!;
	return {
		AtlasReleaseArtifactRef: artifactSchema,
		AtlasRelease: {
			...releaseSchema,
			properties: {
				...properties,
				schemaVersion: {
					const: atlasReleaseData.shape.schemaVersion.value,
				},
				artifacts: {
					type: "array",
					items: {
						$ref: "#/components/schemas/AtlasReleaseArtifactRef",
					},
				},
			},
		},
	};
};
