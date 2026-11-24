import type {
	DatasetDeclaration,
	IndicatorDeclaration,
} from "@uk-data-atlas/datasets";
import type {
	Measure,
	MeasureAggregation,
	MeasureObservationArtifact,
	MeasureSource,
	SourceGeography,
} from "@uk-data-atlas/catalogue/node";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import type { CatalogueRows } from "./rows.ts";
import { type Indicator, publishIndicators } from "./indicators.ts";
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
 * period: its indicators, read from the statistics rows, with the dataset's
 * own notes and boundary year.
 */
export const compileDeclaredIndicators = (
	manifest: CatalogManifest,
	declaration: DatasetDeclaration,
	rows: CatalogueRows,
	codeSets: DeclaredCodeSets,
): CompiledMeasure[] => {
	const catalogue = catalogueOf(declaration);
	if (catalogue.period === undefined)
		throw new Error(`${declaration.id} declares no single period`);
	return publishIndicators(manifest, {
		datasetId: declaration.id,
		rows,
		boundaryYear: declaration.boundary.year,
		period: catalogue.period,
		...(catalogue.codes
			? { expectedCodes: [...codeSets[catalogue.codes]] }
			: {}),
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
 * The same for a dataset with one period per year: each indicator is
 * published for every year the rows hold.
 */
export const compileYearlyIndicators = (
	{ manifestPath, datasets }: CatalogManifest,
	declaration: DatasetDeclaration,
	rows: CatalogueRows,
): { measures: Measure[]; artifacts: MeasureObservationArtifact[] } => {
	const catalogue = catalogueOf(declaration);
	const { id } = declaration;
	const { year } = declaration.boundary;
	const dataset = datasets.find((candidate) => candidate.id === id);
	if (!dataset) throw new Error(`${manifestPath} has no ${id} dataset`);
	const { boundaryYears } = dataset.summary;
	if (!boundaryYears.includes(year))
		throw new Error(
			`${manifestPath}: ${id} must declare boundary year ${year}`,
		);
	const geography = declaration.boundary.type as SourceGeography["type"];
	// A dataset may also hold editions published on other boundary years (IMD
	// 2015 is on the 2011 LSOAs). The catalogue lists the declared boundary
	// and the earlier releases below, and the manifest counts cover every
	// boundary the dataset holds.
	const editions = rows.editions(id, geography);
	// Earlier releases of the same geography the statistics are also stored
	// on, newest first. Each holds every area under the codes of its year, so
	// an area's periods from before its code changed are served from there.
	const alsoIn = (declaration.statistics as { alsoIn?: unknown } | undefined)
		?.alsoIn;
	const earlierYears = (
		Array.isArray(alsoIn)
			? (alsoIn as Array<{ geography: string; year: number }>)
			: []
	)
		.filter(
			(release) => release.geography === geography && release.year < year,
		)
		.map((release) => release.year)
		.sort((a, b) => b - a);
	const periodsOn = (
		indicator: (typeof catalogue.indicators)[number],
		boundaryYear: number,
	) => {
		const source = {
			series: {
				measure: indicator.measure,
				dimensions: indicator.members,
			},
			datasetId: id,
			geography,
			boundaryYear,
		};
		const elsewhere = new Set(
			editions
				.filter(
					(edition) =>
						edition.boundaryYear !== year &&
						!editions.some(
							(other) =>
								other.period === edition.period &&
								other.boundaryYear === year,
						),
				)
				.map(({ period }) => period),
		);
		return boundaryYear === year
			? rows.periods(
					source,
					rows
						.heldPeriods(rows.selector(source))
						.filter((period) => !elsewhere.has(period)),
				)
			: rows.periods(
					source,
					editions
						.filter(
							(edition) => edition.boundaryYear === boundaryYear,
						)
						.map(({ period }) => period),
				);
	};
	const published = catalogue.indicators.map((indicator) => {
		const periods = periodsOn(indicator, year);
		if (periods.length === 0)
			throw new Error(
				`${id}: the rows hold no periods of ${indicator.id}`,
			);
		const everyBoundary = boundaryYears.map((boundaryYear) =>
			boundaryYear === year
				? periods
				: periodsOn(indicator, boundaryYear),
		);
		const records = everyBoundary.reduce(
			(total, held) =>
				total +
				held.reduce((sum, period) => sum + period.records.length, 0),
			0,
		);
		const { summary } = dataset;
		const checks = catalogue.checks ?? [];
		if (
			checks.includes("manifest-records") &&
			records !== summary.dataRecordCount
		)
			throw new Error(
				`${id}: expected ${summary.dataRecordCount} records from the manifest, found ${records}`,
			);
		const heldPeriods = everyBoundary.reduce(
			(total, held) => total + held.length,
			0,
		);
		if (
			checks.includes("manifest-periods") &&
			heldPeriods !== summary.datasetCount
		)
			throw new Error(
				`${id}: expected ${summary.datasetCount} periods from the manifest, found ${heldPeriods}`,
			);
		const first = everyBoundary.reduce(
			(total, held) => total + (held[0]?.records.length ?? 0),
			0,
		);
		if (
			checks.includes("manifest-areas") &&
			first !== summary.dataRecordCount
		)
			throw new Error(
				`${id}: expected ${summary.dataRecordCount} areas from the manifest, found ${first}`,
			);
		const series = {
			measure: indicator.measure,
			dimensions: indicator.members,
		};
		const seriesKey = measureSeriesKey(series);
		const sourceGeography = { type: geography, boundaryYear: year };
		const content = JSON.stringify({
			schemaVersion: 1,
			measureId: seriesKey,
			sourceGeography,
			periods,
		});
		const artifact: MeasureObservationArtifact = {
			schemaVersion: 1,
			contentHash: sha256(content),
			measureId: seriesKey,
			sourceGeography,
			periods,
		};
		const earlier = earlierYears.flatMap((boundaryYear) => {
			const held = rows
				.periods({ series, datasetId: id, geography, boundaryYear })
				.filter((period) => period.records.length > 0);
			if (held.length === 0) return [];
			const earlierGeography = { type: geography, boundaryYear };
			const earlierArtifact: MeasureObservationArtifact = {
				schemaVersion: 1,
				contentHash: sha256(
					JSON.stringify({
						schemaVersion: 1,
						measureId: seriesKey,
						sourceGeography: earlierGeography,
						periods: held,
					}),
				),
				measureId: seriesKey,
				sourceGeography: earlierGeography,
				periods: held,
			};
			return [earlierArtifact];
		});
		return { indicator, series, artifact, earlier };
	});
	return {
		measures: published.map(
			({ indicator, series, artifact, earlier }): Measure => {
				const aggregation = aggregationOf(indicator.aggregation);
				return {
					id: indicator.id,
					series,
					label: indicator.label,
					valueKind: indicator.valueKind,
					unit: indicator.unit.includes("{areas}")
						? indicator.unit.replace(
								"{areas}",
								(
									artifact.periods[0]?.records.length ?? 0
								).toLocaleString("en-GB"),
							)
						: indicator.unit,
					aggregation,
					sources: [
						{
							datasetId: id,
							periods: artifact.periods.map(
								({ period }) => period,
							),
							sourceGeography: {
								type: geography,
								boundaryYear: year,
							},
							coverage: {
								kind: catalogue.partial
									? "partial"
									: "source-reported",
								countries: countriesFor(
									artifact.periods[0]?.records ?? [],
								),
								// The latest period, since coverage can vary by period.
								recordCount:
									artifact.periods.at(-1)?.records.length ??
									0,
								note: catalogue.coverageNote,
							},
						},
						...earlier.map((held): MeasureSource => ({
							datasetId: id,
							observationArtifact: `${indicator.id}-${geography}-${held.sourceGeography.boundaryYear}-observations`,
							periods: held.periods.map(({ period }) => period),
							sourceGeography: held.sourceGeography,
							coverage: {
								kind: "partial",
								countries: countriesFor(
									held.periods.flatMap(
										({ records }) => records,
									),
								),
								recordCount:
									held.periods.at(-1)?.records.length ?? 0,
								note: `Every year under the authority codes in force in ${held.sourceGeography.boundaryYear}, so an authority merged or recoded since keeps the years before its change. An authority that did not yet exist has no value.`,
							},
						})),
					],
					availability: {
						sourceExact: true,
						conversion: false,
						aggregation: aggregation.available,
					},
					links: { data: `/v1/data/${indicator.id}` },
					notes: [...indicator.notes, ...declaration.source.notes],
				};
			},
		),
		artifacts: published.flatMap(({ artifact, earlier }) => [
			artifact,
			...earlier,
		]),
	};
};
