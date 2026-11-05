import type { DatasetDeclaration } from "@uk-data-atlas/datasets/declaration/dataset";
import { type DatasetInput } from "./input.ts";
import { type Indicator, publishIndicators } from "./indicators.ts";
import type { CatalogManifest, CompiledMeasure } from "./manifest.ts";

/** The code sets a declared catalogue may check its records against. */
export type DeclaredCodeSets = { authorities: Iterable<string> };

/**
 * The API catalogue measures of a declared dataset: its indicators, read from
 * the compiled records, with the dataset's own notes and boundary year.
 */
export const compileDeclaredIndicators = (
	manifest: CatalogManifest,
	declaration: DatasetDeclaration,
	path: DatasetInput,
	codeSets: DeclaredCodeSets,
): CompiledMeasure[] => {
	const { catalogue } = declaration;
	if (!catalogue)
		throw new Error(`${declaration.id} declares no catalogue measures`);
	return publishIndicators(manifest, {
		datasetId: declaration.id,
		path,
		boundaryYear: declaration.boundary.year,
		period: catalogue.period,
		...(catalogue.codes
			? { expectedCodes: [...codeSets[catalogue.codes]] }
			: {}),
		...(catalogue.mergeApril2023 ? { mergeApril2023: true } : {}),
		coverageNote: catalogue.coverageNote,
		notes: [...declaration.source.notes],
		indicators: catalogue.indicators.map((indicator): Indicator => ({
			id: indicator.id,
			label: indicator.label,
			field: indicator.field,
			valueKind: indicator.valueKind,
			unit: indicator.unit,
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: true,
			},
			notes: [...indicator.notes],
		})),
	});
};
