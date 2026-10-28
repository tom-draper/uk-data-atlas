import { BrexitLADDataset, BrexitLADData } from "../../types/referendum";
import { parseCsv } from "../../helpers/parseCsv";
import { parseNum } from "../../helpers/parseNumber";

export async function loadBrexit(
	read: (path: string) => Promise<string>,
): Promise<Record<string, BrexitLADDataset>> {
	const { data } = await parseCsv(
		await read(
			"politics/referendum/local-authorities/2016/EU-referendum-result-data.csv",
		),
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
