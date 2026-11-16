import {
	measureSeriesSourceKey,
	measureSeriesKey,
	observationArtifactName,
	type AnyMeasureObservationArtifact,
	type DataCatalog,
	type Measure,
	type MeasureSource,
	type MeasureTableArtifact,
} from "@uk-data-atlas/measures";

/** Validate every generated source against its canonical series and partition. */
export function validateObservationSeries(
	catalog: DataCatalog,
	observations: readonly AnyMeasureObservationArtifact[],
	tables: readonly MeasureTableArtifact[],
): void {
	const key = (measure: Measure, source: MeasureSource) => {
		if (!measure.series)
			throw new Error(`Missing series identity for ${measure.id}.`);
		return measureSeriesSourceKey(measure.series, source);
	};
	const required = new Set<string>();
	for (const measure of catalog.measures)
		for (const source of measure.sources) {
			const identity = key(measure, source);
			if (required.has(identity))
				throw new Error(
					`Duplicate catalogue series source: ${identity}`,
				);
			required.add(identity);
		}
	const measures = new Map(
		catalog.measures.map((measure) => [measure.id, measure]),
	);
	const series = new Map<string, Measure[]>();
	for (const measure of catalog.measures) {
		if (!measure.series)
			throw new Error(`Missing series identity for ${measure.id}.`);
		const id = measureSeriesKey(measure.series);
		series.set(id, [...(series.get(id) ?? []), measure]);
	}
	const accept = (
		measure: Measure | undefined,
		source: MeasureSource | undefined,
		description: string,
	) => {
		if (!measure || !source)
			throw new Error(`No catalogue source matches ${description}.`);
		const identity = key(measure, source);
		if (!required.delete(identity))
			throw new Error(
				`Unexpected or duplicate observation series: ${identity}`,
			);
	};
	for (const artifact of observations) {
		const measure = measures.get(artifact.measureId);
		const source = measure?.sources.find(
			(candidate) =>
				candidate.sourceGeography.type ===
					artifact.sourceGeography.type &&
				candidate.sourceGeography.boundaryYear ===
					artifact.sourceGeography.boundaryYear,
		);
		accept(
			measure,
			source,
			`${artifact.measureId} on ${artifact.sourceGeography.type} ${artifact.sourceGeography.boundaryYear}`,
		);
	}
	for (const table of tables)
		for (const id of table.measures) {
			const match = series
				.get(id)
				?.flatMap((measure) =>
					measure.sources
						.filter(
							(candidate) =>
								candidate.datasetId === table.datasetId &&
								candidate.sourceGeography.type ===
									table.sourceGeography.type &&
								candidate.sourceGeography.boundaryYear ===
									table.sourceGeography.boundaryYear &&
								observationArtifactName(
									measure.id,
									candidate,
								) === table.id,
						)
						.map((source) => ({ measure, source })),
				)[0];
			accept(match?.measure, match?.source, `${id} in ${table.id}`);
		}
	if (required.size)
		throw new Error(
			`Missing observation series: ${[...required].join(", ")}`,
		);
}
