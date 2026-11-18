import type { DirectPart, DirectRecord } from "../../declaration/statistics.ts";
import { periods } from "../../declaration/statistics.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { SALFORD_WARD_CODE_REMAP } from "./wardCodes.ts";
import { sourceDir } from "../../declaration/sources.ts";

const MEDIAN_PRICE_PATH = sourceDir(
	"house-price-median",
	"hpssadataset37medianpricepaidbyward.zip",
);
const MEAN_PRICE_PATH = sourceDir(
	"house-price-mean",
	"hpssadataset38meanpricepaidbyward.zip",
);

type XlsSheetRowReader = (
	path: string,
	sheet: string,
	visit: (row: ReadonlyMap<number, string>) => void,
) => Promise<void>;

type PriceColumn = { index: number; year: number };

type PriceRow = {
	ladCode: string;
	ladName: string;
	wardCode: string;
	wardName: string;
	sourceWardCode?: string;
	prices: Record<number, number>;
};

const cell = (
	row: ReadonlyMap<number, string>,
	headers: ReadonlyMap<string, number>,
	name: string,
) => row.get(headers.get(name) ?? -1)?.trim() ?? "";

const priceColumnsFor = (headers: ReadonlyMap<string, number>) =>
	[...headers.entries()].flatMap(([header, index]) => {
		const year = index >= 4 ? header.match(/\d{4}/)?.[0] : undefined;
		return year ? [{ index, year: Number(year) }] : [];
	});

function pricesForRow(
	row: ReadonlyMap<number, string>,
	priceColumns: readonly PriceColumn[],
): Record<number, number> {
	const prices: Record<number, number> = {};
	for (const { index, year } of priceColumns) {
		// Medians of an even number of sales land on a half penny, and the
		// workbooks hold that rather than the rounded figure they display.
		const rawPrice = parseNullableNum(row.get(index));
		const price = rawPrice === null ? null : Math.round(rawPrice);
		if (price === null) continue;
		prices[year] = price;
	}
	return prices;
}

function priceRow(
	row: ReadonlyMap<number, string>,
	headers: ReadonlyMap<string, number>,
	priceColumns: readonly PriceColumn[],
): PriceRow | undefined {
	const rawCode = cell(row, headers, "Ward code");
	if (!rawCode) return;
	const wardCode = SALFORD_WARD_CODE_REMAP[rawCode] ?? rawCode;
	return {
		ladCode: cell(row, headers, "Local authority code"),
		ladName: cell(row, headers, "Local authority name"),
		wardCode,
		wardName: cell(row, headers, "Ward name"),
		...(wardCode !== rawCode ? { sourceWardCode: rawCode } : {}),
		prices: pricesForRow(row, priceColumns),
	};
}

const readPriceRows = async (
	readRows: XlsSheetRowReader,
	path: string,
	visit: (
		row: ReadonlyMap<number, string>,
		headers: ReadonlyMap<string, number>,
		priceColumns: readonly PriceColumn[],
	) => void,
) => {
	let headers: Map<string, number> | undefined;
	let priceColumns: PriceColumn[] = [];
	await readRows(path, "1a", (row) => {
		if (!headers) {
			const values = [...row.values()];
			if (
				!values.some((value) =>
					value.toLowerCase().includes("local authority code"),
				)
			)
				return;
			headers = new Map(
				[...row.entries()].map(([index, value]) => [
					value.trim(),
					index,
				]),
			);
			priceColumns = priceColumnsFor(headers);
			return;
		}
		visit(row, headers, priceColumns);
	});
	if (!headers)
		throw new Error(
			`${path}: no header row containing local authority code`,
		);
};

/** A ward's price for each year, as rows of one measure. */
const priceValues = (measure: string, prices: Record<number, number>) =>
	Object.entries(prices).map(([year, value]) => ({
		measure,
		value,
		period: periods.year(Number(year)),
	}));

/**
 * Median and mean house prices paid in each ward of England and Wales, for
 * every year of the final ONS ward edition. Salford's wards move onto their
 * 2021 codes and keep the code they were published under as a parent.
 */
export async function housePriceStatisticsParts(
	readRows: XlsSheetRowReader,
): Promise<DirectPart[]> {
	const medianByWard: Record<string, PriceRow> = {};
	const meanByWard: Record<string, PriceRow> = {};
	await Promise.all([
		readPriceRows(
			readRows,
			MEDIAN_PRICE_PATH,
			(row, headers, priceColumns) => {
				const price = priceRow(row, headers, priceColumns);
				if (price) medianByWard[price.wardCode] = price;
			},
		),
		readPriceRows(
			readRows,
			MEAN_PRICE_PATH,
			(row, headers, priceColumns) => {
				const price = priceRow(row, headers, priceColumns);
				if (price) meanByWard[price.wardCode] = price;
			},
		),
	]);

	const records: DirectRecord[] = [];
	for (const wardCode of new Set([
		...Object.keys(medianByWard),
		...Object.keys(meanByWard),
	])) {
		const ward = medianByWard[wardCode] ?? meanByWard[wardCode];
		records.push({
			code: wardCode,
			name: ward.wardName,
			parents: {
				ladCode: { code: ward.ladCode, name: ward.ladName },
				...(ward.sourceWardCode
					? { sourceWardCode: { code: ward.sourceWardCode } }
					: {}),
			},
			values: [
				...priceValues(
					"house-price-median",
					medianByWard[wardCode]?.prices ?? {},
				),
				...priceValues(
					"house-price-mean",
					meanByWard[wardCode]?.prices ?? {},
				),
			],
		});
	}
	return [{ key: "2023", records }];
}
