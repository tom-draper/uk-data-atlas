import type { DatasetDefinition, DatasetReader } from "./data/catalog/types";

/** Compile raw source contents and attach the declared country coverage. */
export async function compileDatasetContents(
	definition: DatasetDefinition,
	reader: DatasetReader,
) {
	const compiled = await definition.precompile(reader);
	return definition.coverageCountries
		? Object.fromEntries(
				Object.entries(compiled).map(([id, dataset]) => [
					id,
					{
						...dataset,
						coverageCountries: definition.coverageCountries,
					},
				]),
			)
		: compiled;
}
