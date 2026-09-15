import { readFileSync } from "node:fs";
import type { Measure } from "../dataCatalog";
import { isPublishedAreaCode, countriesFor } from "./countries";
import { type PopulationFile, sha256, number, object } from "./values";

/**
 * Life expectancy at birth, as ONS publishes it for local areas: every
 * three-year period from 2001 to 2003, each with its 95% confidence interval.
 *
 * ONS publishes male and female series but no persons total, so there is no
 * total measure. The series is read from its own compiled dataset rather than
 * the website's, which holds only the latest period and adds averaged values
 * for the four authorities created in April 2023.
 */
export const compileLifeExpectancy = (lifeExpectancySeriesPath: string) => {
	const lifeExpectancySource = JSON.parse(
		readFileSync(lifeExpectancySeriesPath, "utf8"),
	) as PopulationFile;
	const lifeExpectancyPeriods = Object.entries(lifeExpectancySource)
		.map(([key, value]) => {
			const entry = object(value, `${lifeExpectancySeriesPath}.${key}`);
			if (
				entry.boundaryType !== "localAuthority" ||
				entry.boundaryYear !== 2021 ||
				typeof entry.period !== "string" ||
				!/^\d{4}-\d{4}$/.test(entry.period)
			) {
				throw new Error(
					`${lifeExpectancySeriesPath}.${key}: expected a local-authority period on the 2021 code vintage`,
				);
			}
			return {
				period: entry.period,
				data: object(
					entry.data,
					`${lifeExpectancySeriesPath}.${key}.data`,
				),
			};
		})
		.sort((left, right) => left.period.localeCompare(right.period));
	const lifeExpectancyMeasures = (["male", "female"] as const).map((sex) => {
		const measureId = `life-expectancy-${sex}`;
		const periods = lifeExpectancyPeriods.map(({ period, data }) => ({
			period,
			records: Object.entries(data)
				.map(([areaCode, record]) => {
					const context = `${lifeExpectancySeriesPath}.${period}.${areaCode}.${sex}`;
					if (!isPublishedAreaCode(areaCode))
						throw new Error(`${context}: unsupported area code`);
					const estimate = object(
						object(record, context)[sex],
						context,
					);
					const value = number(estimate.value, `${context}.value`);
					const lower = number(estimate.lower, `${context}.lower`);
					const upper = number(estimate.upper, `${context}.upper`);
					if (!(lower <= value && value <= upper))
						throw new Error(
							`${context}: the interval ${lower} to ${upper} does not contain ${value}`,
						);
					return {
						areaCode,
						value,
						status: "observed" as const,
						confidenceInterval: { lower, upper },
					};
				})
				.sort((left, right) =>
					left.areaCode.localeCompare(right.areaCode),
				),
		}));
		const sourceGeography = {
			type: "localAuthority" as const,
			boundaryYear: 2021,
		};
		const content = JSON.stringify({
			schemaVersion: 1,
			measureId,
			sourceGeography,
			periods,
		});
		const latestRecords = periods.at(-1)?.records ?? [];
		const measure: Measure = {
			id: measureId,
			label: `${sex === "male" ? "Male" : "Female"} life expectancy at birth`,
			valueKind: "quantity",
			unit: "years",
			aggregation: {
				kind: "non-aggregatable",
				statistic: "life-expectancy",
				note: "The life expectancy of a combined population is not an average of its areas' life expectancies, weighted or not. It has to be recalculated from deaths and population by age, which this source does not publish.",
				available: false,
			},
			sources: [
				{
					datasetId: "life-expectancy-series",
					periods: periods.map((period) => period.period),
					sourceGeography,
					coverage: {
						kind: "partial",
						countries: countriesFor(latestRecords),
						recordCount: latestRecords.length,
						note: "England, Wales and Northern Ireland. Scotland's local life expectancy is published separately by National Records of Scotland.",
					},
				},
			],
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: false,
			},
			links: { data: `/v1/data/${measureId}` },
			uncertainty: {
				kind: "confidence-interval",
				level: 0.95,
				note: "The publisher's 95% confidence interval, reflecting the random variation in deaths behind each estimate. Overlapping intervals mean two areas cannot be told apart with confidence, even when their central values differ.",
			},
			notes: [
				"Each period is a three-year period life expectancy, not a forecast for anyone born in it.",
				"On the publisher's December 2021 local-authority codes, to which ONS restates the whole series. The four authorities created in April 2023 are not published and are not served; their predecessor districts are.",
			],
		};
		return {
			measure,
			artifact: {
				schemaVersion: 1 as const,
				contentHash: sha256(content),
				measureId,
				sourceGeography,
				periods,
			},
		};
	});
	return {
		measures: lifeExpectancyMeasures.map(({ measure }) => measure),
		artifacts: lifeExpectancyMeasures.map(({ artifact }) => artifact),
	};
};
