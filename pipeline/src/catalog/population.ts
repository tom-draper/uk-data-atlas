import type { CatalogManifest } from "./manifest.ts";
import type {
	Measure,
	MeasureObservationArtifact,
} from "@uk-data-atlas/catalogue/node";
import { sha256 } from "./values.ts";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import type { CatalogueRows, RowSource } from "./rows.ts";

const populationSeries = { measure: "population" } as const;

/** The periods of a population partition, each code checked against its pattern. */
const partitionPeriods = (
	rows: CatalogueRows,
	source: Omit<RowSource, "series">,
	codePattern: RegExp,
	periods?: string[],
): MeasureObservationArtifact["periods"] => {
	const read = rows.periods({ ...source, series: populationSeries }, periods);
	if (read.length === 0)
		throw new Error(`${source.datasetId} has no population periods`);
	for (const { period, records } of read)
		for (const { areaCode } of records)
			if (!codePattern.test(areaCode))
				throw new Error(
					`${source.datasetId}.${period}: unsupported area code ${areaCode}`,
				);
	return read;
};

const localAuthorityPopulationRecords = (rows: CatalogueRows) => {
	const periods = partitionPeriods(
		rows,
		{
			datasetId: "population-uk",
			geography: "localAuthority",
			boundaryYear: 2023,
		},
		/^[ENSW]\d{8}$/,
	);
	const codes = (period: (typeof periods)[number]) =>
		period.records.map((record) => record.areaCode).join(",");
	if (periods.some((period) => codes(period) !== codes(periods[0]!)))
		throw new Error(
			"population-uk: local-authority codes change between periods",
		);
	return periods;
};

/**
 * The population estimate from its three source partitions: 2022 wards,
 * local authorities for every mid-year, and ONS's own constituency estimates.
 */
export const compilePopulation = (
	{ manifestPath, datasets }: CatalogManifest,
	rows: CatalogueRows,
): {
	measure: Measure;
	wardObservations: MeasureObservationArtifact;
	localAuthorityObservations: MeasureObservationArtifact;
	constituencyObservations: MeasureObservationArtifact;
} => {
	const seriesKey = measureSeriesKey({ measure: "population" });
	const population = datasets.find((dataset) => dataset.id === "population");
	if (!population)
		throw new Error(`${manifestPath} has no population dataset`);
	const populationUk = datasets.find(
		(dataset) => dataset.id === "population-uk",
	);
	if (!populationUk)
		throw new Error(`${manifestPath} has no population-uk dataset`);
	const [{ records }] = partitionPeriods(
		rows,
		{ datasetId: "population", geography: "ward", boundaryYear: 2023 },
		/^[EW]\d{8}$/,
		["2022"],
	) as [MeasureObservationArtifact["periods"][number]];
	if (records.length !== population.summary.dataRecordCount) {
		throw new Error(
			`population: expected ${population.summary.dataRecordCount} records from the manifest, found ${records.length}`,
		);
	}
	if (
		population.summary.boundaryYears.length !== 1 ||
		population.summary.boundaryYears[0] !== 2023
	) {
		throw new Error(
			`${manifestPath}: population must declare boundary year 2023`,
		);
	}
	const countries = countriesFor(records);
	// ONS's own constituency estimates, one partition per mid-year.
	const constituencyPeriods = partitionPeriods(
		rows,
		{
			datasetId: "population-constituency",
			geography: "constituency",
			boundaryYear: 2024,
		},
		/^(E14|W07)\d{6}$/,
	);
	const constituencyDataset = datasets.find(
		(dataset) => dataset.id === "population-constituency",
	);
	if (!constituencyDataset)
		throw new Error(
			`${manifestPath} has no population-constituency dataset`,
		);
	const constituencyRecordCount = constituencyPeriods.reduce(
		(total, period) => total + period.records.length,
		0,
	);
	if (
		constituencyRecordCount !== constituencyDataset.summary.dataRecordCount
	) {
		throw new Error(
			`population-constituency: expected ${constituencyDataset.summary.dataRecordCount} records from the manifest, found ${constituencyRecordCount}`,
		);
	}
	const constituencyContent = JSON.stringify({
		schemaVersion: 1,
		measureId: seriesKey,
		sourceGeography: { type: "constituency", boundaryYear: 2024 },
		periods: constituencyPeriods,
	});
	const localAuthorityPeriods = localAuthorityPopulationRecords(rows);
	const localAuthorityRecords = localAuthorityPeriods.flatMap(
		(period) => period.records,
	);
	if (localAuthorityRecords.length !== populationUk.summary.dataRecordCount) {
		throw new Error(
			`population-uk: expected ${populationUk.summary.dataRecordCount} records from the manifest, found ${localAuthorityRecords.length}`,
		);
	}
	if (localAuthorityPeriods.length !== populationUk.summary.datasetCount) {
		throw new Error(
			`population-uk: expected ${populationUk.summary.datasetCount} periods from the manifest, found ${localAuthorityPeriods.length}`,
		);
	}
	if (
		populationUk.summary.boundaryYears.length !== 1 ||
		populationUk.summary.boundaryYears[0] !== 2023
	) {
		throw new Error(
			`${manifestPath}: population-uk must declare boundary year 2023`,
		);
	}
	const measure: Measure = {
		id: "population",
		label: "Population estimate",
		valueKind: "count",
		unit: "people",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		sources: [
			{
				datasetId: "population",
				periods: ["2022"],
				sourceGeography: { type: "ward", boundaryYear: 2023 },
				coverage: {
					kind: "partial",
					countries,
					recordCount: records.length,
					note: "Published source records are available for England and Wales only; this endpoint does not infer Scottish or Northern Irish values.",
				},
			},
			{
				datasetId: "population-uk",
				periods: localAuthorityPeriods.map((period) => period.period),
				sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
				observationArtifact: "population-local-authority-observations",
				coverage: {
					kind: "source-reported",
					countries: countriesFor(
						localAuthorityPeriods[0]?.records ?? [],
					),
					recordCount: localAuthorityPeriods[0]?.records.length ?? 0,
					note: "Published source records cover all four UK nations for every available period. Historic values remain keyed to the source's 2023 local-authority code vintage.",
				},
			},
			{
				datasetId: "population-constituency",
				periods: constituencyPeriods.map((period) => period.period),
				sourceGeography: { type: "constituency", boundaryYear: 2024 },
				observationArtifact: "population-constituency-observations",
				coverage: {
					kind: "partial",
					countries: countriesFor(
						constituencyPeriods[0]?.records ?? [],
					),
					recordCount: constituencyPeriods[0]?.records.length ?? 0,
					note: "Published by ONS for the constituencies first contested in July 2024, in England and Wales only. These are ONS's own estimates for each constituency, not ward estimates added up: wards do not nest within these constituencies, and the published ward lookup splits some wards between them without weights.",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: true,
		},
		links: { data: "/v1/data/population" },
	};
	const wardPeriods = [{ period: "2022", records }];
	const observationsContent = JSON.stringify({
		schemaVersion: 1,
		measureId: seriesKey,
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		periods: wardPeriods,
	});
	const localAuthorityObservationsContent = JSON.stringify({
		schemaVersion: 1,
		measureId: seriesKey,
		sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
		periods: localAuthorityPeriods,
	});
	return {
		measure,
		wardObservations: {
			schemaVersion: 1,
			contentHash: sha256(observationsContent),
			measureId: seriesKey,
			sourceGeography: { type: "ward", boundaryYear: 2023 },
			periods: wardPeriods,
		},
		localAuthorityObservations: {
			schemaVersion: 1,
			contentHash: sha256(localAuthorityObservationsContent),
			measureId: seriesKey,
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
			periods: localAuthorityPeriods,
		},
		constituencyObservations: {
			schemaVersion: 1,
			contentHash: sha256(constituencyContent),
			measureId: seriesKey,
			sourceGeography: { type: "constituency", boundaryYear: 2024 },
			periods: constituencyPeriods,
		},
	};
};
