import { HousePriceDataset, WardHousePriceData } from "../types";
import { withCDN } from "../helpers/cdn";
import { parseCsv, findHeaderLine } from "../helpers/parseCsv";
import { parseNullableInt } from "../helpers/parseNumber";
import { useDataLoader } from "./useDataLoader";

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
		const wardData: Record<string, WardHousePriceData> = {};

		for (const row of data as any[]) {
			const wardCode = row["Ward code"]?.trim();
			if (!wardCode) continue;

			const prices: Record<number, number> = {};
			for (const period of timePeriodHeaders) {
				const price = parseNullableInt(row[period]);
				if (price !== null) {
					const yearMatch = period.match(/\d{4}/);
					if (yearMatch) prices[parseInt(yearMatch[0])] = price;
				}
			}

			wardData[wardCode] = {
				localAuthorityCode: row["Local authority code"]?.trim() || "",
				localAuthorityName: row["Local authority name"]?.trim() || "",
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
