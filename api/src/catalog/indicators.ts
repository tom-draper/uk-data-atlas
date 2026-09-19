import type {
	Measure,
	MeasureAggregation,
	PopulationObservation,
	SourceGeography,
} from "../dataCatalog";
import { countriesFor } from "./countries";
import { localAuthorityFieldWithGaps } from "./localAuthorityFields";
import { onApril2023Authorities } from "./authorityChanges";
import type { CatalogManifest, CompiledMeasure } from "./manifest";
import { sha256 } from "./values";

export type Indicator = {
	id: string;
	label: string;
	field: string;
	valueKind: Measure["valueKind"];
	unit: string;
	aggregation: MeasureAggregation;
	notes: string[];
	/**
	 * `derived` for values the compiled dataset computed rather than read
	 * from the publisher, such as a mean over a published grid.
	 */
	status?: PopulationObservation["status"];
};

/**
 * Single-period local-authority indicators, each checked against the code
 * set it claims before it is published.
 *
 * Every value must name an authority of the expected set, and any authority
 * of that set without a value is listed in the coverage note by code rather
 * than left for a caller to discover as a short total. A dataset compiled
 * with the April 2023 authorities beside the districts they replaced is
 * reduced to the authorities first, as the census partitions are.
 */
export const publishIndicators = (
	{ manifestPath, datasets }: CatalogManifest,
	spec: {
		datasetId: string;
		path: string;
		boundaryYear: number;
		period: string;
		/**
		 * The codes a complete partition holds. Without it the partition is
		 * not checked here, and the compatibility report is what compares it
		 * with the boundary releases.
		 */
		expectedCodes?: string[];
		isAuthority?: (code: string) => boolean;
		geography?: SourceGeography["type"];
		/** The code vintage the partition is labelled with, when not the dataset's. */
		partitionBoundaryYear?: number;
		table?: "data" | "partnerships" | "lsoas";
		/**
		 * The observation artifact's name after the measure id, for a further
		 * partition of measures another call has already published.
		 */
		artifactStem?: string;
		mergeApril2023?: boolean;
		coverageNote: string;
		notes: string[];
		indicators: Indicator[];
	},
) => {
	const indicatorObservations: CompiledMeasure[] = [];
	const dataset = datasets.find(
		(candidate) => candidate.id === spec.datasetId,
	);
	if (!dataset)
		throw new Error(`${manifestPath} has no ${spec.datasetId} dataset`);
	if (
		dataset.summary.boundaryYears.length !== 1 ||
		dataset.summary.boundaryYears[0] !== spec.boundaryYear
	)
		throw new Error(
			`${manifestPath}: ${spec.datasetId} must declare boundary year ${spec.boundaryYear}`,
		);
	const geography = spec.geography ?? "localAuthority";
	const partitionBoundaryYear =
		spec.partitionBoundaryYear ?? spec.boundaryYear;
	const expected = new Set(spec.expectedCodes ?? []);
	for (const indicator of spec.indicators) {
		const read = localAuthorityFieldWithGaps(
			spec.path,
			indicator.field,
			spec.boundaryYear,
			spec.isAuthority,
			spec.table,
			geography === "localPlanningAuthority" ? geography : undefined,
		);
		let records = indicator.status
			? read.records.map((record) => ({
					...record,
					status: indicator.status!,
				}))
			: read.records;
		if (spec.mergeApril2023) {
			const present = new Set(records.map((record) => record.areaCode));
			records = onApril2023Authorities(
				{ period: spec.period, records },
				[...expected].filter((code) => present.has(code)),
			).records;
		}
		const unexpected = spec.expectedCodes
			? records.filter((record) => !expected.has(record.areaCode))
			: [];
		if (unexpected.length > 0)
			throw new Error(
				`${spec.path}: ${indicator.id} has codes outside its ${partitionBoundaryYear} ${geography} set, starting with ${unexpected[0]!.areaCode}`,
			);
		const published = new Set(records.map((record) => record.areaCode));
		const missing = (spec.expectedCodes ?? [])
			.filter((code) => !published.has(code))
			.sort();
		const periods = [{ period: spec.period, records }];
		const content = JSON.stringify({
			schemaVersion: 1,
			measureId: indicator.id,
			sourceGeography: {
				type: geography,
				boundaryYear: partitionBoundaryYear,
			},
			periods,
		});
		indicatorObservations.push({
			measure: {
				id: indicator.id,
				label: indicator.label,
				valueKind: indicator.valueKind,
				unit: indicator.unit,
				aggregation: indicator.aggregation,
				sources: [
					{
						datasetId: spec.datasetId,
						...(spec.artifactStem
							? {
									observationArtifact: `${indicator.id}-${spec.artifactStem}-observations`,
								}
							: {}),
						periods: [spec.period],
						sourceGeography: {
							type: geography,
							boundaryYear: partitionBoundaryYear,
						},
						coverage: {
							kind:
								missing.length === 0
									? "source-reported"
									: "partial",
							countries: countriesFor(records),
							recordCount: records.length,
							note:
								missing.length === 0
									? spec.coverageNote
									: `${spec.coverageNote} No value is published for ${missing.length} of the ${expected.size} authorities: ${missing.join(", ")}.`,
						},
					},
				],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: indicator.aggregation.available,
				},
				links: { data: `/v1/data/${indicator.id}` },
				notes: [...indicator.notes, ...spec.notes],
			},
			artifact: {
				schemaVersion: 1,
				contentHash: sha256(content),
				measureId: indicator.id,
				sourceGeography: {
					type: geography,
					boundaryYear: partitionBoundaryYear,
				},
				periods,
			},
		});
	}
	return indicatorObservations;
};

/**
 * A measure published in more than one partition, such as road collisions
 * by local authority and by LSOA, is one measure with a source for each.
 */
export const mergeMeasurePartitions = (
	observations: CompiledMeasure[],
): Measure[] => [
	...observations
		.reduce((measures, { measure }) => {
			const published = measures.get(measure.id);
			measures.set(
				measure.id,
				published
					? {
							...published,
							sources: [...published.sources, ...measure.sources],
							notes: [
								...new Set([
									...(published.notes ?? []),
									...(measure.notes ?? []),
								]),
							],
						}
					: measure,
			);
			return measures;
		}, new Map<string, Measure>())
		.values(),
];
