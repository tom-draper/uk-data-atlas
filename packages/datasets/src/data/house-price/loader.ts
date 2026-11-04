import {
	type HousePriceDataset,
	type HousePriceWardData,
} from "../../types/housePrice.ts";
import { parseNullableNum } from "../../helpers/parseNumber.ts";
import { SALFORD_WARD_CODE_REMAP } from "./wardCodes.ts";

const MEDIAN_PRICE_PATH =
	"economics/housing/median-price-by-ward/hpssadataset37medianpricepaidbyward.zip";
const MEAN_PRICE_PATH =
	"economics/housing/mean-price-by-ward/hpssadataset38meanpricepaidbyward.zip";

type XlsSheetRowReader = (
	path: string,
	sheet: string,
	visit: (row: ReadonlyMap<number, string>) => void,
) => Promise<void>;

type PriceColumn = { index: number; year: number };

type PriceRow = Omit<HousePriceWardData, "prices" | "meanPrices"> & {
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

export async function loadHousePrice(
	readRows: XlsSheetRowReader,
): Promise<Record<string, HousePriceDataset>> {
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

	const wardData: Record<string, HousePriceWardData> = {};
	for (const [wardCode, median] of Object.entries(medianByWard)) {
		wardData[wardCode] = {
			...median,
			meanPrices: meanByWard[wardCode]?.prices ?? {},
		};
	}
	for (const [wardCode, mean] of Object.entries(meanByWard)) {
		if (wardData[wardCode]) continue;
		wardData[wardCode] = {
			...mean,
			prices: {},
			meanPrices: mean.prices,
		};
	}

	return {
		2023: {
			id: "housePrice2023",
			type: "housePrice",
			year: 2023,
			boundaryYear: 2021,
			boundaryType: "ward",
			data: wardData,
		},
	};
}
