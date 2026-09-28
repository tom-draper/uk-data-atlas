import { loadHousePrice } from "../../house-price/loader";
import type { HousePriceDataset } from "@/lib/types/housePrice";
import type { DatasetDefinition } from "../types";

export const housePriceDatasetDefinition: DatasetDefinition<HousePriceDataset> =
	{
		type: "housePrice",
		precompiledFile: "house-price",
		boundaryType: "ward",
		coverageCountries: ["GB-ENG", "GB-WLS"],
		source: {
			name: "House Prices",
			source: "Office for National Statistics",
			sourceUrl:
				"https://www.ons.gov.uk/peoplepopulationandcommunity/housing/datasets/medianpricepaidbywardhpssadataset37",
			year: "1995-2023",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Median and mean house prices paid by ward for England and Wales.",
		},
		// Table 1a of each workbook, read from inside the published zips.
		precompile: async ({ xlsSheet }) =>
			loadHousePrice((path) => xlsSheet(path, "1a")),
	};
