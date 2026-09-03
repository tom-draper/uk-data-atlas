import { HousePriceDataset, HousePriceWardData } from "@/lib/types/housePrice";
import { parseCsv, findHeaderLine } from "@/lib/helpers/parseCsv";
import { parseNullableInt } from "@/lib/helpers/parseNumber";

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

export async function loadHousePrice(
	read: (path: string) => Promise<string>,
): Promise<Record<string, HousePriceDataset>> {
	const csvText = await read(
		"economics/housing/HPSSA Dataset 37 - Median price paid by wardHPSSA Dataset 37 - Median price paid by ward.csv",
	);
	const skipLines = findHeaderLine(csvText, "local authority code");
	const { data, fields } = await parseCsv(csvText, {
		header: true,
		skipLines,
	});

	const timePeriodHeaders = fields.slice(4);
	const wardData: Record<string, HousePriceWardData> = {};

	for (const row of data as any[]) {
		const rawCode = row["Ward code"]?.trim();
		if (!rawCode) continue;
		const wardCode = SALFORD_WARD_CODE_REMAP[rawCode] ?? rawCode;

		const prices: Record<number, number> = {};
		for (const period of timePeriodHeaders) {
			const price = parseNullableInt(row[period]);
			if (price !== null) {
				const yearMatch = period.match(/\d{4}/);
				if (yearMatch) prices[parseInt(yearMatch[0])] = price;
			}
		}

		wardData[wardCode] = {
			ladCode: row["Local authority code"]?.trim() || "",
			ladName: row["Local authority name"]?.trim() || "",
			wardCode,
			wardName: row["Ward name"]?.trim() || "",
			prices,
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
