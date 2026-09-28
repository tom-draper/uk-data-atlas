import { readFileSync } from "node:fs";
import type {
	MeasureSource,
	Measure,
	PopulationObservation,
	MeasureObservationArtifact,
} from "../dataCatalog";
import {
	APRIL_2023_LAD_MERGERS,
	APRIL_2020_2021_LAD_MERGERS,
} from "./authorityChanges";
import { countriesFor } from "./countries";
import type { CatalogManifest } from "./manifest";
import { sha256 } from "./values";

/**
 * ONS's final model-based unemployment estimates, in the two code vintages
 * the workbook itself holds.
 *
 * The model estimated every district from 1996, and separately estimated
 * Buckinghamshire from 2016 and the two Northamptonshire authorities from
 * 2020, so for those years the workbook holds both the districts and the
 * authorities that replaced them. Serving both in one partition would count
 * the same residents twice. So the districts form an April 2019 partition
 * over every period, and the replacement authorities an April 2021
 * partition over the years all three are estimated. The four authorities
 * of April 2023 were never estimated; the compiled dataset builds them from
 * their districts, and those derived records are not served.
 */
export const compileUnemployment = (
	{ manifestPath, datasets }: CatalogManifest,
	unemploymentPath: string,
	populationCodes: Set<string>,
) => {
	const unemploymentFile = JSON.parse(
		readFileSync(unemploymentPath, "utf8"),
	) as Record<
		string,
		{
			periodLabels?: Record<string, string>;
			data?: Record<
				string,
				{
					rates?: Record<string, number | null>;
					rateIntervals?: Record<string, number | null>;
					levels?: Record<string, number | null>;
					levelIntervals?: Record<string, number | null>;
					derivedFromPredecessors?: string[];
				}
			>;
		}
	>;
	const unemploymentDataset = datasets.find(
		(candidate) => candidate.id === "unemployment",
	);
	if (!unemploymentDataset)
		throw new Error(`${manifestPath} has no unemployment dataset`);
	const [unemploymentEdition, ...laterEditions] =
		Object.values(unemploymentFile);
	if (
		!unemploymentEdition?.data ||
		!unemploymentEdition.periodLabels ||
		laterEditions.length > 0
	)
		throw new Error(
			`${unemploymentPath}: expected one edition with its period labels`,
		);
	const unemploymentData = unemploymentEdition.data;
	/** "April 1996 to March 1997" as 1996-97, "January to December 2004" as 2004. */
	const unemploymentPeriods = Object.entries(
		unemploymentEdition.periodLabels,
	).map(([key, label]) => {
		const financial = /^April (\d{4}) to March (\d{4})$/.exec(label);
		const calendar = /^January to December (\d{4})$/.exec(label);
		if (financial && Number(financial[2]) === Number(financial[1]) + 1)
			return { key, period: `${financial[1]}-${financial[2].slice(2)}` };
		if (calendar && calendar[1] === key) return { key, period: key };
		throw new Error(`${unemploymentPath}: unrecognised period ${label}`);
	});
	const notModelled = new Set(["E09000001", "E06000053"]);
	const greatBritain2021 = [
		...[...populationCodes].filter(
			(code) =>
				!code.startsWith("N") && !(code in APRIL_2023_LAD_MERGERS),
		),
		...Object.values(APRIL_2023_LAD_MERGERS).flat(),
	].filter((code) => !notModelled.has(code));
	const greatBritain2019 = [
		...greatBritain2021.filter(
			(code) => !(code in APRIL_2020_2021_LAD_MERGERS),
		),
		...Object.values(APRIL_2020_2021_LAD_MERGERS).flat(),
	];
	const derivedCodes = Object.entries(unemploymentData)
		.filter(([, record]) => record.derivedFromPredecessors)
		.map(([code]) => code)
		.sort();
	if (
		derivedCodes.join() !==
		Object.keys(APRIL_2023_LAD_MERGERS).sort().join()
	)
		throw new Error(
			`${unemploymentPath}: only the April 2023 authorities may be derived, found ${derivedCodes.join(", ")}`,
		);
	const published = Object.keys(unemploymentData)
		.filter((code) => !derivedCodes.includes(code))
		.sort();
	const expectedPublished = [
		...new Set([...greatBritain2019, ...greatBritain2021]),
	].sort();
	if (published.join() !== expectedPublished.join())
		throw new Error(
			`${unemploymentPath}: estimated authorities are not exactly the April 2019 and April 2021 Great Britain code sets`,
		);
	const round1 = (value: number) => Number(value.toFixed(1));
	const unemploymentPartition = (
		measureId: string,
		valueField: "rates" | "levels",
		intervalField: "rateIntervals" | "levelIntervals",
		boundaryYear: 2019 | 2021,
	) => {
		const codes =
			boundaryYear === 2019 ? greatBritain2019 : greatBritain2021;
		const periods = unemploymentPeriods
			.map(({ key, period }) => ({
				period,
				records: codes
					.flatMap((areaCode): PopulationObservation[] => {
						const value =
							unemploymentData[areaCode]?.[valueField]?.[key];
						if (value === null || value === undefined) return [];
						const halfWidth =
							unemploymentData[areaCode]?.[intervalField]?.[key];
						return [
							{
								areaCode,
								value,
								status: "observed",
								...(halfWidth === null ||
								halfWidth === undefined
									? {}
									: {
											confidenceInterval: {
												lower: round1(
													value - halfWidth,
												),
												upper: round1(
													value + halfWidth,
												),
											},
										}),
							},
						];
					})
					.sort((left, right) =>
						left.areaCode.localeCompare(right.areaCode),
					),
			}))
			// The 2021 partition holds only years every one of its authorities
			// is estimated; the districts' partition holds every year.
			.filter((period) =>
				boundaryYear === 2019
					? period.records.length > 0
					: period.records.length === codes.length,
			)
			.sort((left, right) => left.period.localeCompare(right.period));
		const observationArtifact = `${measureId}-localAuthority-${boundaryYear}-observations`;
		const sourceGeography = {
			type: "localAuthority" as const,
			boundaryYear,
		};
		const content = JSON.stringify({
			schemaVersion: 1,
			measureId,
			sourceGeography,
			periods,
		});
		const latest = periods.at(-1);
		return {
			source: {
				datasetId: "unemployment",
				periods: periods.map((period) => period.period),
				sourceGeography,
				observationArtifact,
				coverage: {
					kind: "partial" as const,
					countries: countriesFor(latest?.records ?? []),
					recordCount: latest?.records.length ?? 0,
					note:
						boundaryYear === 2019
							? "Great Britain's local authorities as they stood in April 2019, for every period from April 1996 to March 1997 to 2021. The City of London and the Isles of Scilly were never estimated, and an authority has no value for a period before the model covered it; the count here is the latest period's."
							: "Great Britain's local authorities as they stood in April 2021, for 2020 and 2021, the years the model estimated Buckinghamshire and North and West Northamptonshire alongside every other authority. The City of London and the Isles of Scilly were never estimated.",
				},
			} satisfies MeasureSource,
			artifact: {
				schemaVersion: 1 as const,
				contentHash: sha256(content),
				measureId,
				sourceGeography,
				periods,
			},
		};
	};
	const unemploymentNotes = [
		"ONS model-based estimates, combining Annual Population Survey unemployment with the claimant count averaged over twelve months. They are the final edition: ONS discontinued the series in August 2022, and current local estimates are published in its LI01 tables instead.",
		"Periods to 2003 are financial years, labelled like 1996-97; periods from 2004 are calendar years. Survey responses from January 2020 to March 2022 were reweighted by the publisher in June 2022.",
		"Buckinghamshire and the two Northamptonshire authorities are served only in the April 2021 partition, and the districts they replaced only in the April 2019 one, so no partition counts anyone twice. The model's estimate for a new authority is its own, and need not equal its districts' combined estimate.",
	];
	const unemploymentUncertainty = {
		kind: "confidence-interval" as const,
		level: 0.95,
		note: "The publisher's 95% confidence interval. The two Northamptonshire authorities and Buckinghamshire are published without one.",
	};
	const unemploymentMeasures: Measure[] = [];
	const unemploymentArtifacts: MeasureObservationArtifact[] = [];
	for (const spec of [
		{
			id: "unemployment-rate",
			label: "Unemployment rate",
			valueKind: "ratio" as const,
			unit: "% of economically active residents aged 16 and over",
			valueField: "rates" as const,
			intervalField: "rateIntervals" as const,
			aggregation: {
				kind: "intensive" as const,
				operation: "weighted-mean" as const,
				weight: {
					description:
						"Economically active residents aged 16 and over, which the publisher does not state but which is the level divided by the rate.",
					datasetField: "levels / rates",
				},
				available: false,
			},
			note: "Unemployed residents aged 16 and over as a share of the economically active: those in work or looking for it. A rate does not add over areas.",
		},
		{
			id: "unemployment-level",
			label: "Unemployed residents",
			valueKind: "count" as const,
			unit: "unemployed residents aged 16 and over",
			valueField: "levels" as const,
			intervalField: "levelIntervals" as const,
			aggregation: {
				kind: "extensive" as const,
				operation: "sum" as const,
				available: true,
			},
			note: "A sum of these modelled levels is itself an estimate. Its uncertainty is not the sum of its members' intervals, so no interval is given for a sum.",
		},
	]) {
		const partitions = ([2019, 2021] as const).map((boundaryYear) =>
			unemploymentPartition(
				spec.id,
				spec.valueField,
				spec.intervalField,
				boundaryYear,
			),
		);
		unemploymentMeasures.push({
			id: spec.id,
			label: spec.label,
			valueKind: spec.valueKind,
			unit: spec.unit,
			aggregation: spec.aggregation,
			sources: partitions.map(({ source }) => source),
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: spec.aggregation.available,
			},
			links: { data: `/v1/data/${spec.id}` },
			uncertainty: unemploymentUncertainty,
			notes: [spec.note, ...unemploymentNotes],
		});
		unemploymentArtifacts.push(
			...partitions.map(({ artifact }) => artifact),
		);
	}
	if (unemploymentDataset.summary.boundaryYears.join() !== "2024")
		throw new Error(
			`${manifestPath}: unemployment must declare boundary year 2024`,
		);
	return { measures: unemploymentMeasures, artifacts: unemploymentArtifacts };
};
