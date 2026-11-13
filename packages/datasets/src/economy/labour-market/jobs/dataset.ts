import type { JobsDataset } from "../../../types/jobs.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure, per100k } from "../../../declaration/measures.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { loadPopulationUk } from "../../../data/population/ukLoader.ts";
import { aggregateJobs } from "../../../data/jobs/aggregate.ts";
import { loadJobs } from "../../../data/jobs/loader.ts";

export const jobs = defineDataset<JobsDataset>({
	id: "jobs",
	topic: "labour-market",
	boundary: { type: "localAuthority", year: 2023 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	source: {
		name: "Jobs",
		publisher: "Office for National Statistics",
		sourceUrl: "https://www.nomisweb.co.uk/datasets/jd",
		year: "2011-2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Office for National Statistics. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Total jobs by local authority district, 2011 to 2024, on April 2023 codes: employee jobs, self-employment jobs, government-supported trainees and HM Forces, counted at the workplace and rounded to the nearest thousand. Great Britain is complete for every year; Northern Ireland is published for 2020 to 2022 only.",
		cadence: "annual",
		notes: [
			"Counted where the work is, not where the worker lives, and rounded by the publisher to the nearest thousand.",
		],
	},
	ingestion: {
		minimumDatasets: 14,
		// Great Britain's 350 districts in every year; Northern Ireland adds
		// eleven only in 2020 to 2022.
		minimumDataRecords: 350,
		expectedBoundaryYears: [2023],
		requiredDataFields: ["totalJobs"],
	},
	load: async ({ text, xlsxSheet }) =>
		loadJobs(text, await loadPopulationUk(xlsxSheet)),
	statistics: {
		payload: {
			header: {
				coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
			},
			code: "ladCode",
		},
		name: "ladName",
		measures: [
			measure(
				"total-jobs",
				"Total jobs",
				"jobs",
				"count",
				"sum",
				"Jobs located in the area: employee jobs, self-employment, government-supported trainees and HM Forces.",
			),
		],
		fields: [{ path: "totalJobs", measure: "total-jobs" }],
		...per100k((record) => record.totalJobs),
	},
	display: {
		label: "Jobs [2024]",
		year: 2024,
		card: {
			heading: "Jobs",
			coverage: "United Kingdom",
			source: "Office for National Statistics. Jobs. nomisweb.co.uk",
			fixedMeasure: "total",
		},
		measures: [
			{
				id: "total",
				label: "Total",
				field: "totalJobs",
				colorRange: { min: 0, max: 500000 },
				legend: {
					min: 0,
					max: 1000000,
					format: { kind: "compact" },
				},
				card: { unit: "jobs", maximum: 1000000 },
			},
			{
				id: "perPopulation",
				label: "Per pop.",
				field: "metrics.per100kPopulation",
				colorRange: { min: 0, max: 100000 },
				legend: {
					min: 0,
					max: 100000,
					format: {
						kind: "decimal",
						digits: 0,
						suffix: " per 100k residents",
					},
				},
			},
		],
		aggregation: { scope: "localAuthority", aggregate: aggregateJobs },
	},
});
