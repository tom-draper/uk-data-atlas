import { HousePriceDataset, HousePriceWardData } from "@/lib/types/housePrice";
import { parseCsv, findHeaderLine } from "@/lib/helpers/parseCsv";
import { parseNullableNum } from "@/lib/helpers/parseNumber";

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

async function parsePriceRows(csvText: string) {
	const skipLines = findHeaderLine(csvText, "local authority code");
	return parseCsv(csvText, { header: true, skipLines });
}

function pricesForRow(
	row: Record<string, string>,
	timePeriodHeaders: string[],
): Record<number, number> {
	const prices: Record<number, number> = {};
	for (const period of timePeriodHeaders) {
		// Medians of an even number of sales land on a half penny, and the
		// workbooks hold that rather than the rounded figure they display.
		const rawPrice = parseNullableNum(row[period]);
		const price = rawPrice === null ? null : Math.round(rawPrice);
		if (price === null) continue;
		const yearMatch = period.match(/\d{4}/);
		if (yearMatch) prices[parseInt(yearMatch[0])] = price;
	}
	return prices;
}

export async function loadHousePrice(
	read: (path: string) => Promise<string>,
): Promise<Record<string, HousePriceDataset>> {
	const [medianCsv, meanCsv] = await Promise.all([
		read(MEDIAN_PRICE_PATH),
		read(MEAN_PRICE_PATH),
	]);
	const [median, mean] = await Promise.all([
		parsePriceRows(medianCsv),
		parsePriceRows(meanCsv),
	]);
	const wardData: Record<string, HousePriceWardData> = {};

	for (const row of median.data) {
		const rawCode = row["Ward code"]?.trim();
		if (!rawCode) continue;
		const wardCode = SALFORD_WARD_CODE_REMAP[rawCode] ?? rawCode;

		wardData[wardCode] = {
			ladCode: row["Local authority code"]?.trim() || "",
			ladName: row["Local authority name"]?.trim() || "",
			wardCode,
			wardName: row["Ward name"]?.trim() || "",
			prices: pricesForRow(row, median.fields.slice(4)),
			meanPrices: {},
		};
	}

	for (const row of mean.data) {
		const rawCode = row["Ward code"]?.trim();
		if (!rawCode) continue;
		const wardCode = SALFORD_WARD_CODE_REMAP[rawCode] ?? rawCode;
		const meanPrices = pricesForRow(row, mean.fields.slice(4));
		const existing = wardData[wardCode];
		if (existing) {
			existing.meanPrices = meanPrices;
			continue;
		}

		wardData[wardCode] = {
			ladCode: row["Local authority code"]?.trim() || "",
			ladName: row["Local authority name"]?.trim() || "",
			wardCode,
			wardName: row["Ward name"]?.trim() || "",
			prices: {},
			meanPrices,
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
