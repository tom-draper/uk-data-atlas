import { odsTableRows, type OdsTableOptions } from "../spreadsheet/ods.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { loadPopulationUk } from "../population/ukLoader.ts";
import type {
	IndicatorDataset,
	IndicatorRecord,
} from "../../types/indicator.ts";
import type { BoundaryType } from "../boundaries/catalog.ts";
import { sourceDir } from "../../declaration/sources.ts";

type IndicatorType =
	| "business-activity"
	| "net-additional-dwellings"
	| "local-government-finance"
	| "council-tax"
	| "waste"
	| "adult-social-care-activity"
	| "adult-social-care-outcomes"
	| "planning-applications"
	| "electric-vehicle-chargers"
	| "housing-affordability";

const source = (path: string) => path;
const numeric = (value: unknown) => parseNullableNum(value) ?? null;
import { mapAuthorityCode } from "./authorityCode.ts";

const dataset = <T extends IndicatorType>(
	type: T,
	year: number,
	boundaryType: BoundaryType,
	boundaryYear: number,
	data: Record<string, IndicatorRecord>,
): Record<string, IndicatorDataset<T>> => ({
	[String(year)]: {
		id: `${type}${year}`,
		type,
		year,
		boundaryType,
		boundaryYear,
		data,
	},
});

async function addPopulationMetrics(
	records: Record<string, IndicatorRecord>,
	readSheet: (path: string, sheet: string) => Promise<string>,
) {
	const population = await loadPopulationUk(readSheet);
	const latest = population["2024"]?.data ?? {};
	for (const [code, record] of Object.entries(records)) {
		const total = Object.values(latest[code]?.total ?? {}).reduce(
			(sum, value) => sum + value,
			0,
		);
		if (total > 0) {
			record.metrics = {
				per100kPopulation: (record.value / total) * 100_000,
			};
		}
	}
}

/**
 * ONS table 5c: the ratio of the median price paid for existing dwellings
 * (year ending September) to median gross annual residence-based earnings.
 * Authorities ONS suppresses for the year ("[x]") are left out.
 */
