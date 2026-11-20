import type { CatalogueRows } from "./rows.ts";
import type { Measure } from "@uk-data-atlas/measures";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import { sha256 } from "./values.ts";

/**
 * Life expectancy at birth, as ONS publishes it for local areas: every
 * three-year period from 2001 to 2003, each with its 95% confidence interval.
 *
 * ONS publishes male and female series but no persons total, so there is no
 * total measure. The series is read from its own compiled dataset rather than
 * the website's, which holds only the latest period and adds averaged values
 * for the four authorities created in April 2023.
 */
export const compileLifeExpectancy = (rows: CatalogueRows) => {
	const lifeExpectancyMeasures = (["male", "female"] as const).map((sex) => {
		const measureId = `life-expectancy-${sex}`;
		const series = {
			measure: "life-expectancy",
			dimensions: { sex },
		};
		const seriesKey = measureSeriesKey(series);
		const periods = rows.periods({
			series,
			datasetId: "life-expectancy-series",
			geography: "localAuthority",
			boundaryYear: 2025,
		});
		const sourceGeography = {
			type: "localAuthority" as const,
			boundaryYear: 2025,
		};
		const content = JSON.stringify({
			schemaVersion: 1,
			measureId: seriesKey,
			sourceGeography,
			periods,
		});
		const latestRecords = periods.at(-1)?.records ?? [];
		const measure: Measure = {
			id: measureId,
			series,
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
						note: "Every local authority in all four UK nations, except the City of London and the Isles of Scilly, which have no published values of their own.",
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
				"On the publisher's May 2025 local-authority codes, to which ONS restates the whole series across all four nations. The English counties the workbook also lists overlap their districts and are not served.",
			],
		};
		return {
			measure,
			artifact: {
				schemaVersion: 1 as const,
				contentHash: sha256(content),
				measureId: seriesKey,
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
