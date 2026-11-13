import {
	type BrexitLADDataset,
	type BrexitLADData,
} from "../../types/referendum.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parseNum } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";

export async function loadBrexit(
	read: (path: string) => Promise<string>,
): Promise<Record<string, BrexitLADDataset>> {
	const { data } = await parseCsv(
		await read(sourceDir("brexit", "EU-referendum-result-data.csv")),
		{ header: true },
	);

	const records: Record<string, BrexitLADData> = {};
	const resultMap: Record<string, "remain" | "leave"> = {};

	for (const row of data as Record<string, string>[]) {
		const areaCode = row["Area_Code"]?.trim() || "";
		// Gibraltar voted with the South West but is not a UK area.
		if (!areaCode || areaCode === "GI") continue;

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
		boundaryYear: 2016,
		data: records,
		results: resultMap,
	};

	return { [dataset.year]: dataset };
}
