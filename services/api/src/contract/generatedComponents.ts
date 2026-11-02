import { z } from "zod";
import { atlasReleaseArtifact, atlasReleaseData } from "./atlasRelease";
import { rootDocument } from "./rootContract";
import { measureDimensions } from "../catalogueLoader";

/**
 * Every older measure id that carried a breakdown, each with the measure and
 * members it is read as. They are deprecated aliases with no sunset date.
 */
export const deprecatedMeasureAliases = () => {
	const { ids } = measureDimensions.config;
	const deprecated = Object.entries(ids)
		.filter(([id, mapping]) => id !== mapping.measure)
		.sort(([left], [right]) => left.localeCompare(right));
	return {
		description:
			"An older measure id that named a breakdown, and sometimes a dataset, as part of the id. Each is still accepted wherever a measure id is, and is read as the measure and members `x-resolves-to` gives; the response names it in `resolvedFrom` and carries a `Deprecation` header. Name the measure and filter on its dimensions instead. No sunset date is set.",
		type: "string",
		deprecated: true,
		enum: deprecated.map(([id]) => id),
		"x-resolves-to": Object.fromEntries(
			deprecated.map(([id, mapping]) => [
				id,
				{
					measure: mapping.measure,
					...(mapping.dimensions
						? { dimensions: mapping.dimensions }
						: {}),
					...(mapping.datasetId
						? { datasetId: mapping.datasetId }
						: {}),
				},
			]),
		),
	};
};

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
	const {
		$schema: _rootSchema,
		additionalProperties: _rootExtra,
		...rootSchema
	} = z.toJSONSchema(rootDocument);
	return {
		DeprecatedMeasureAlias: deprecatedMeasureAliases(),
		RootDocument: rootSchema,
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
