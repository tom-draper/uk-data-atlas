import { readFileSync } from "node:fs";
import type {
	Measure,
	PopulationObservation,
	MeasureObservationArtifact,
} from "../dataCatalog";
import { type PrecompiledFile, sha256, number, object } from "./values";
import type { CatalogManifest, CompiledMeasure } from "./manifest";
import { countriesFor } from "./countries";

/**
 * The last period published for a full calendar year. The workbook is a
 * quarterly rolling series, and each year's figure here is the year ending
 * December; the final edition stops at the year ending March 2023, which is
 * not comparable and so is not published as a period.
 */
const LAST_DECEMBER_PERIOD = 2022;

/**
 * The house price partition, restored to the codes its publisher used.
 *
 * The website moves Salford's twenty wards onto their 2021 codes so the map
 * joins, but those wards were redrawn in 2021: a price measured on the old ward
 * is not a price for the new one. The compiled record keeps the published code
 * as `sourceWardCode`, so every value is served under the code it was published
 * against, and the list of moved wards lives only in the website loader.
 */
const housePricePeriods = (
	path: string,
): MeasureObservationArtifact["periods"] => {
	const source = JSON.parse(readFileSync(path, "utf8")) as PrecompiledFile;
	const edition = object(source["2023"], `${path}.2023`);
	if (edition.boundaryType !== "ward") {
		throw new Error(`${path}: expected ward-level house prices`);
	}
	const data = object(edition.data, `${path}.2023.data`);
	const byPeriod = new Map<string, PopulationObservation[]>();
	for (const [compiledCode, record] of Object.entries(data)) {
		const sourceWardCode = object(
			record,
			`${path}.${compiledCode}`,
		).sourceWardCode;
		const areaCode =
			typeof sourceWardCode === "string" ? sourceWardCode : compiledCode;
		if (!/^[EW]\d{8}$/.test(areaCode)) {
			throw new Error(`${path}: unsupported ward code ${areaCode}`);
		}
		const prices = object(
			object(record, `${path}.${compiledCode}`).prices,
			`${path}.${compiledCode}.prices`,
		);
		for (const [year, price] of Object.entries(prices)) {
			if (!/^\d{4}$/.test(year) || Number(year) > LAST_DECEMBER_PERIOD)
				continue;
			const records = byPeriod.get(year) ?? [];
			records.push({
				areaCode,
				value: number(price, `${path}.${compiledCode}.prices.${year}`),
				status: "observed",
			});
			byPeriod.set(year, records);
		}
	}
	const periods = [...byPeriod.entries()]
		.map(([period, records]) => ({
			period,
			records: records.sort((left, right) =>
				left.areaCode.localeCompare(right.areaCode),
			),
		}))
		.sort((left, right) => left.period.localeCompare(right.period));
	if (periods.length === 0) throw new Error(`${path} has no house prices`);
	return periods;
};

/** Ward median house prices, served under the codes they were published against. */
export const compileHousePrice = (
	{ manifestPath, datasets }: CatalogManifest,
	housePricePath: string,
): CompiledMeasure => {
	const housePrice = datasets.find((dataset) => dataset.id === "house-price");
	if (!housePrice)
		throw new Error(`${manifestPath} has no house-price dataset`);
	const housePriceByPeriod = housePricePeriods(housePricePath);
	const housePriceContent = JSON.stringify({
		schemaVersion: 1,
		measureId: "house-price-median",
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
			"Ward codes are those the publisher used, which are mostly December 2020 ward codes. Two Leeds wards carry later codes in the source itself, so the partition is not an exact code set for any one release.",
			"Medians of an even number of sales fall on a half penny in the workbook; values are rounded to the whole pound the publisher displays.",
		],
	};
	return {
		measure: housePriceMeasure,
		artifact: {
			schemaVersion: 1,
			contentHash: sha256(housePriceContent),
			measureId: "house-price-median",
			sourceGeography: { type: "ward", boundaryYear: 2020 },
			periods: housePriceByPeriod,
		},
	};
};
