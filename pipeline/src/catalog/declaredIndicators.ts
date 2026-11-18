import type {
	DatasetDeclaration,
	IndicatorDeclaration,
} from "@uk-data-atlas/datasets";
import type {
	Measure,
	MeasureAggregation,
	MeasureObservationArtifact,
} from "@uk-data-atlas/catalogue/node";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import { type DatasetInput } from "./input.ts";
import { type Indicator, publishIndicators } from "./indicators.ts";
import { localAuthorityFieldPeriods } from "./localAuthorityFields.ts";
import type { CatalogManifest, CompiledMeasure } from "./manifest.ts";
import { sha256 } from "./values.ts";
import { measureSeriesKey } from "@uk-data-atlas/measures";

/** The code sets a declared catalogue may check its records against. */
export type DeclaredCodeSets = {
	authorities: Iterable<string>;
	england2025: Iterable<string>;
};

const aggregationOf = (
	aggregation: IndicatorDeclaration["aggregation"],
): MeasureAggregation =>
	aggregation === "sum"
		? { kind: "extensive", operation: "sum", available: true }
		: aggregation.kind === "non-aggregatable"
			? { ...aggregation, available: false }
			: {
					kind: "intensive",
					operation: "weighted-mean",
					weight: { ...aggregation.weight },
					available: aggregation.available === true,
				};

const catalogueOf = (declaration: DatasetDeclaration) => {
	const { catalogue } = declaration;
	if (!catalogue)
		throw new Error(`${declaration.id} declares no catalogue measures`);
	return catalogue;
};

/**
 * The API catalogue measures of a declared dataset whose file holds one
 * period: its indicators, read from the compiled records, with the dataset's
 * own notes and boundary year.
 */
export const compileDeclaredIndicators = (
	manifest: CatalogManifest,
	declaration: DatasetDeclaration,
	path: DatasetInput,
	codeSets: DeclaredCodeSets,
): CompiledMeasure[] => {
	const catalogue = catalogueOf(declaration);
	if (catalogue.period === undefined)
		throw new Error(`${declaration.id} declares no single period`);
	return publishIndicators(manifest, {
		datasetId: declaration.id,
		path,
		boundaryYear: declaration.boundary.year,
		period: catalogue.period,
		...(catalogue.codes
			? { expectedCodes: [...codeSets[catalogue.codes]] }
			: {}),
		...(catalogue.authorityCodes
			? {
					isAuthority: (code: string) =>
						catalogue.authorityCodes!.test(code),
				}
			: {}),
		...(catalogue.mergeApril2023 ? { mergeApril2023: true } : {}),
		coverageNote: catalogue.coverageNote,
		notes: [...declaration.source.notes],
		indicators: catalogue.indicators.map((indicator): Indicator => ({
			id: indicator.id,
			series: {
				measure: indicator.measure,
				dimensions: indicator.members,
			},
			label: indicator.label,
			field: indicator.field,
			valueKind: indicator.valueKind,
			unit: indicator.unit,
			aggregation: aggregationOf(indicator.aggregation),
			notes: [...indicator.notes],
			...(indicator.status ? { status: indicator.status } : {}),
		})),
	});
};

/**
 * The same for a file with one entry per year: each indicator is published
 * for every year the file holds.
 */
export const compileYearlyIndicators = (
	{ manifestPath, datasets }: CatalogManifest,
	declaration: DatasetDeclaration,
	path: DatasetInput,
): { measures: Measure[]; artifacts: MeasureObservationArtifact[] } => {
	const catalogue = catalogueOf(declaration);
	const { id } = declaration;
	const { year } = declaration.boundary;
	const dataset = datasets.find((candidate) => candidate.id === id);
	if (!dataset) throw new Error(`${manifestPath} has no ${id} dataset`);
	if (
		dataset.summary.boundaryYears.length !== 1 ||
		dataset.summary.boundaryYears[0] !== year
	)
		throw new Error(
			`${manifestPath}: ${id} must declare boundary year ${year}`,
		);
	const published = catalogue.indicators.map((indicator) => {
		const periods = localAuthorityFieldPeriods(path, indicator.field, year);
		const series = {
			measure: indicator.measure,
			dimensions: indicator.members,
		};
		const seriesKey = measureSeriesKey(series);
		const content = JSON.stringify({
			schemaVersion: 1,
			measureId: seriesKey,
			sourceGeography: { type: "localAuthority", boundaryYear: year },
			periods,
		});
		const artifact: MeasureObservationArtifact = {
			schemaVersion: 1,
			contentHash: sha256(content),
			measureId: seriesKey,
			sourceGeography: { type: "localAuthority", boundaryYear: year },
			periods,
		};
		return { indicator, series, artifact };
	});
	return {
		measures: published.map(({ indicator, series, artifact }): Measure => {
			const aggregation = aggregationOf(indicator.aggregation);
			return {
				id: indicator.id,
				series,
				label: indicator.label,
				valueKind: indicator.valueKind,
				unit: indicator.unit,
				aggregation,
				sources: [
					{
						datasetId: id,
						periods: artifact.periods.map(({ period }) => period),
						sourceGeography: {
							type: "localAuthority",
							boundaryYear: year,
						},
						coverage: {
							kind: "source-reported",
							countries: countriesFor(
								artifact.periods[0]?.records ?? [],
							),
							recordCount:
								artifact.periods[0]?.records.length ?? 0,
							note: catalogue.coverageNote,
						},
					},
				],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: aggregation.available,
				},
				links: { data: `/v1/data/${indicator.id}` },
				notes: [...indicator.notes, ...declaration.source.notes],
			};
		}),
		artifacts: published.map(({ artifact }) => artifact),
	};
};
