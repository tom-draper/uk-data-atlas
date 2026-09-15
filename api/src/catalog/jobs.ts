import type { Country, Measure } from "../dataCatalog";
import { countryForCode, countriesFor } from "./countries";
import { localAuthorityFieldPeriods } from "./localAuthorityFields";
import type { CatalogManifest, CompiledMeasure } from "./manifest";
import { sha256 } from "./values";

/**
 * Total jobs, counted where the work is.
 *
 * Great Britain is published for every year and Northern Ireland only for
 * 2020 to 2022, so a period's record count depends on the year. That
 * absence is checked here to be whole nations and nothing else: a British
 * district missing from one year, or part of Northern Ireland, would be a
 * gap the coverage note does not describe, and the build refuses it.
 */
export const compileJobs = (
	{ manifestPath, datasets }: CatalogManifest,
	jobsPath: string,
	populationCodes: Set<string>,
): CompiledMeasure => {
	const jobs = datasets.find((dataset) => dataset.id === "jobs");
	if (!jobs) throw new Error(`${manifestPath} has no jobs dataset`);
	if (
		jobs.summary.boundaryYears.length !== 1 ||
		jobs.summary.boundaryYears[0] !== 2023
	) {
		throw new Error(
			`${manifestPath}: jobs must declare boundary year 2023`,
		);
	}
	const jobsPeriods = localAuthorityFieldPeriods(jobsPath, "totalJobs", 2023);
	const jobsRecordCount = jobsPeriods.reduce(
		(total, period) => total + period.records.length,
		0,
	);
	if (jobsRecordCount !== jobs.summary.dataRecordCount) {
		throw new Error(
			`${jobsPath}: expected ${jobs.summary.dataRecordCount} records from the manifest, found ${jobsRecordCount}`,
		);
	}
	if (jobsPeriods.length !== jobs.summary.datasetCount) {
		throw new Error(
			`${jobsPath}: expected ${jobs.summary.datasetCount} periods from the manifest, found ${jobsPeriods.length}`,
		);
	}
	const codesIn = (period: (typeof jobsPeriods)[number], country: Country) =>
		period.records
			.map((record) => record.areaCode)
			.filter((code) => countryForCode(code) === country)
			.join(",");
	for (const country of ["GB-ENG", "GB-SCT", "GB-WLS", "GB-NIR"] as const) {
		const expected = [...populationCodes]
			.filter((code) => countryForCode(code) === country)
			.sort((left, right) => left.localeCompare(right))
			.join(",");
		for (const period of jobsPeriods) {
			const published = codesIn(period, country);
			if (published === expected) continue;
			if (country === "GB-NIR" && published === "") continue;
			throw new Error(
				`${jobsPath}.${period.period}: ${country} districts do not match the 2023 local-authority code set, so the gap is not a whole nation`,
			);
		}
	}
	const jobsCountries = countriesFor(
		jobsPeriods.flatMap((period) => period.records),
	);
	const northernIrelandPeriods = jobsPeriods
		.filter((period) => codesIn(period, "GB-NIR") !== "")
		.map((period) => period.period);
	const jobsContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "total-jobs",
		sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
		periods: jobsPeriods,
	});
	const jobsMeasure: Measure = {
		id: "total-jobs",
		label: "Total jobs",
		valueKind: "count",
		unit: "jobs",
		aggregation: { kind: "extensive", operation: "sum", available: true },
		sources: [
			{
				datasetId: "jobs",
				periods: jobsPeriods.map((period) => period.period),
				sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
				coverage: {
					kind: "partial",
					countries: jobsCountries,
					recordCount: jobsPeriods.at(-1)?.records.length ?? 0,
					note: `Great Britain is published for every period. Northern Ireland is published for ${northernIrelandPeriods.join(", ")} only, and has no records in the other periods rather than zero jobs, so the record count varies by period; the count here is the latest period's.`,
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: true,
		},
		links: { data: "/v1/data/total-jobs" },
		notes: [
			"Jobs located in the authority, counted at the workplace rather than where the worker lives: employee jobs, self-employment jobs, government-supported trainees and HM Forces. A person with two jobs counts twice, and a job held by a commuter counts where it is done.",
			"Each value is rounded by the publisher to the nearest thousand. A sum over areas carries that rounding from every member, so it can differ from a published total for the same place by several thousand.",
			"The publisher restates the whole series on April 2023 district codes with each release, so every period shares one code vintage and no conversion was applied.",
			"Jobs density, jobs per resident aged 16 to 64, is published alongside this series but is not served: it is a ratio and would need the working-age population as a weight to combine over areas.",
		],
	};
	return {
		measure: jobsMeasure,
		artifact: {
			schemaVersion: 1,
			contentHash: sha256(jobsContent),
			measureId: "total-jobs",
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
			periods: jobsPeriods,
		},
	};
};
