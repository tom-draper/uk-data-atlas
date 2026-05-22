import { HousePriceDataset, HousePriceWardData } from "../types";
import { withCDN } from "../helpers/cdn";
import { parseCsv, findHeaderLine } from "../helpers/parseCsv";
import { parseNullableInt } from "../helpers/parseNumber";
import { useDataLoader } from "./useDataLoader";

// The ONS December 2021 ward boundary file already contains Salford's post-May-2022
// ward codes (E05013018–E05013037), skipping the pre-review codes (E05000759–E05000778)
// used by this CSV. Map each old code to its closest geographic equivalent so Salford
// wards display house price data on the map.
const SALFORD_WARD_CODE_REMAP: Record<string, string> = {
	"E05000759": "E05013018", // Barton → Barton & Winton
	"E05000760": "E05013020", // Boothstown and Ellenbrook → Boothstown & Ellenbrook
	"E05000761": "E05013021", // Broughton → Broughton
	"E05000762": "E05013022", // Cadishead → Cadishead & Lower Irlam
	"E05000763": "E05013023", // Claremont → Claremont
	"E05000764": "E05013024", // Eccles → Eccles
	"E05000765": "E05013025", // Irlam → Higher Irlam & Peel Green
	"E05000766": "E05013019", // Irwell Riverside → Blackfriars & Trinity
	"E05000767": "E05013026", // Kersal → Kersal & Broughton Park
	"E05000768": "E05013030", // Langworthy → Pendleton & Charlestown
	"E05000769": "E05013027", // Little Hulton → Little Hulton
	"E05000770": "E05013028", // Ordsall → Ordsall
	"E05000771": "E05013029", // Pendlebury → Pendlebury & Clifton
	"E05000772": "E05013032", // Swinton North → Swinton & Wardley
	"E05000773": "E05013033", // Swinton South → Swinton Park
	"E05000774": "E05013034", // Walkden North → Walkden North
	"E05000775": "E05013035", // Walkden South → Walkden South
	"E05000776": "E05013036", // Weaste and Seedley → Weaste & Seedley
	"E05000777": "E05013031", // Winton → Quays (Barton & Winton receives Barton's data above)
	"E05000778": "E05013037", // Worsley → Worsley & Westwood Park
};

export const useHousePriceData = () => {
	return useDataLoader<HousePriceDataset>(async () => {
		const res = await fetch(
			withCDN(
				"/data/economics/housing/HPSSA Dataset 37 - Median price paid by wardHPSSA Dataset 37 - Median price paid by ward.csv",
			),
		);
		if (!res.ok)
			throw new Error(`Failed to fetch house price data: ${res.statusText}`);

		const csvText = await res.text();
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
	});
};
