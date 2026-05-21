import { BrexitLADDataset, BrexitLADData } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";
import { parseNum } from "../helpers/parseNumber";
import { useDataLoader } from "./useDataLoader";

export const useBrexitData = () => {
	return useDataLoader<BrexitLADDataset>(async () => {
		const response = await fetch(
			withCDN("/data/referendum/EU-referendum-result-data.csv"),
		);
		if (!response.ok)
			throw new Error(`Failed to fetch Brexit data: ${response.statusText}`);

		const { data } = await parseCsv(await response.text(), { header: true });
		const rows = data as Record<string, string>[];

		const records: Record<string, BrexitLADData> = {};
		const resultMap: Record<string, "remain" | "leave"> = {};

		for (const row of rows) {
			const areaCode = row["Area_Code"]?.trim() || "";
			if (!areaCode) continue;

			const pctLeave = parseNum(row["Pct_Leave"]);
			const pctRemain = parseNum(row["Pct_Remain"]);

			records[areaCode] = {
				ladCode: areaCode,
				ladName: row["Area"]?.trim() || "",
				regionName: row["Region"]?.trim() || "",
				regionCode: row["Region_Code"]?.trim() || "",
				electorate: parseNum(row["Electorate"]),
				validVotes: parseNum(row["Valid_Votes"]),
				remain: parseNum(row["Remain"]),
				leave: parseNum(row["Leave"]),
				rejectedBallots: parseNum(row["Rejected_Ballots"]),
				pctRemain,
				pctLeave,
				pctTurnout: parseNum(row["Pct_Turnout"]),
			};
			resultMap[areaCode] = pctLeave > 50 ? "leave" : "remain";
		}

		const dataset: BrexitLADDataset = {
			id: "brexit2016",
			year: 2016,
			type: "brexit",
			boundaryType: "localAuthority",
			boundaryYear: 2023,
			data: records,
			results: resultMap,
		};

		return { [dataset.year]: dataset };
	});
};
