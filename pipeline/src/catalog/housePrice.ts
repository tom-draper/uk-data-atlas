import type {
	Measure,
	MeasureObservationArtifact,
} from "@uk-data-atlas/catalogue/node";
import type { CatalogueRows } from "./rows.ts";
import { sha256 } from "./values.ts";
import type { CatalogManifest, CompiledMeasure } from "./manifest.ts";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import { measureSeriesKey } from "@uk-data-atlas/measures";

/**
 * The last period published for a full calendar year. The workbook is a
 * quarterly rolling series, and each year's figure here is the year ending
 * December; the final edition stops at the year ending March 2023, which is
 * not comparable and so is not published as a period.
 */
const LAST_DECEMBER_PERIOD = 2022;

/**
 * The house price partition, as the API serves it: every value under the code
 * its publisher used, which the selector restores for the twenty Salford wards
 * the website moves onto their 2021 codes. A price measured on the old ward is
 * not a price for the new one.
 */
const housePricePeriods = (
	rows: CatalogueRows,
): MeasureObservationArtifact["periods"] => {
	const source = {
		series: { measure: "house-price-median" },
		datasetId: "house-price",
		geography: "ward",
		boundaryYear: 2020,
	} as const;
	const periods = rows
		.periods(
			source,
			rows
				.heldPeriods(rows.selector(source))
				.filter((period) => Number(period) <= LAST_DECEMBER_PERIOD),
		)
		.filter(({ records }) => records.length > 0);
	if (periods.length === 0) throw new Error("house-price has no prices");
	return periods;
};

/** Ward median house prices, served under the codes they were published against. */
export const compileHousePrice = (
	{ manifestPath, datasets }: CatalogManifest,
	rows: CatalogueRows,
): CompiledMeasure => {
	const seriesKey = measureSeriesKey({ measure: "house-price-median" });
	const housePrice = datasets.find((dataset) => dataset.id === "house-price");
	if (!housePrice)
		throw new Error(`${manifestPath} has no house-price dataset`);
	const housePriceByPeriod = housePricePeriods(rows);
	const housePriceContent = JSON.stringify({
		schemaVersion: 1,
		measureId: seriesKey,
		sourceGeography: { type: "ward", boundaryYear: 2020 },
		periods: housePriceByPeriod,
	});
	const housePriceMeasure: Measure = {
		id: "house-price-median",
		label: "Median house price paid",
		valueKind: "currency",
		unit: "GBP",
		aggregation: {
			kind: "non-aggregatable",
			statistic: "median",
			note: "A median of ward medians is not the median of the underlying sales, and no weight recovers it. Combining areas needs the sales themselves, which this source does not publish.",
			available: false,
		},
		sources: [
			{
				datasetId: "house-price",
				periods: housePriceByPeriod.map((period) => period.period),
				sourceGeography: { type: "ward", boundaryYear: 2020 },
				coverage: {
					kind: "partial",
					countries: countriesFor(
						housePriceByPeriod.at(-1)?.records ?? [],
					),
					recordCount: housePriceByPeriod.at(-1)?.records.length ?? 0,
					note: "Published for England and Wales only. A ward with too few sales in a period has no value for it, so the record count varies by period; the count here is the latest period's.",
				},
			},
		],
		availability: {
			sourceExact: true,
			conversion: false,
			aggregation: false,
		},
		links: { data: "/v1/data/house-price-median" },
		notes: [
			"Each period is the year ending December of that year. The source is a quarterly rolling series whose last edition ends at March 2023; that partial year is not comparable and is not published here.",
			"The publisher's ward codes are mostly December 2020 codes. Temple Newsam's later source code is corrected to its geometrically identical December 2020 code and retained as sourceAreaCode; Garforth & Swillington changed geometry, so its later source code remains unresolved rather than being remapped.",
			"Medians of an even number of sales fall on a half penny in the workbook; values are rounded to the whole pound the publisher displays.",
		],
	};
	return {
		measure: housePriceMeasure,
		artifact: {
			schemaVersion: 1,
			contentHash: sha256(housePriceContent),
			measureId: seriesKey,
			sourceGeography: { type: "ward", boundaryYear: 2020 },
			periods: housePriceByPeriod,
		},
	};
};
