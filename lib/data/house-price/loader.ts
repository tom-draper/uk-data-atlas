import { HousePriceDataset, HousePriceWardData } from "@/lib/types/housePrice";
import { parseNullableNum } from "@/lib/helpers/parseNumber";

/**
 * Salford's wards were redrawn in 2021. The workbook still publishes them under
 * their old codes, so they are moved onto the new ones for the map to join. The
 * old code is kept on the record as `sourceWardCode`, because a price measured
 * on the old ward is not a price for the new one and the API serves it under
 * the code it was published against.
 */
const SALFORD_WARD_CODE_REMAP: Record<string, string> = {
	E05000759: "E05013018",
	E05000760: "E05013020",
	E05000761: "E05013021",
	E05000762: "E05013022",
	E05000763: "E05013023",
	E05000764: "E05013024",
	E05000765: "E05013025",
	E05000766: "E05013019",
	E05000767: "E05013026",
	E05000768: "E05013030",
	E05000769: "E05013027",
	E05000770: "E05013028",
	E05000771: "E05013029",
	E05000772: "E05013032",
	E05000773: "E05013033",
	E05000774: "E05013034",
	E05000775: "E05013035",
	E05000776: "E05013036",
	E05000777: "E05013031",
	E05000778: "E05013037",
};

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
