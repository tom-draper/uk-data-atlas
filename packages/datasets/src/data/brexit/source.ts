import type { DatasetReader } from "../catalog/types.ts";
import type { DirectPart } from "../../declaration/statistics.ts";
import { sourceDir } from "../../declaration/sources.ts";
import { parseNum } from "../../helpers/parseNumber.ts";

/**
 * The 2016 EU referendum result by counting area, as one part keyed "2016".
 * Gibraltar voted with the South West but is not a UK area, so it is left out.
 * Each area sits in its region; the shares are those the Electoral Commission
 * published, not recomputed.
 */
export async function brexitStatisticsParts(
	read: DatasetReader["csvRows"],
): Promise<DirectPart[]> {
	const records: DirectPart["records"] = [];
	await read(
		sourceDir("brexit", "EU-referendum-result-data.csv"),
		{},
		(row) => {
			const code = row["Area_Code"]?.trim() ?? "";
			if (!code || code === "GI") return;
			const number = (column: string) => parseNum(row[column] ?? "");
			records.push({
				code,
				name: row["Area"]?.trim() ?? "",
				parents: {
					regionCode: {
						code: row["Region_Code"]?.trim() ?? "",
						name: row["Region"]?.trim() ?? "",
					},
				},
				values: [
					{ measure: "electorate", value: number("Electorate") },
					{ measure: "valid-votes", value: number("Valid_Votes") },
					{
						measure: "rejected-ballots",
						value: number("Rejected_Ballots"),
					},
					{ measure: "turnout", value: number("Pct_Turnout") },
					...(["remain", "leave"] as const).flatMap((answer) => [
						{
							measure: "referendum-votes",
							members: { "referendum-answer": answer },
							value: number(
								answer === "remain" ? "Remain" : "Leave",
							),
						},
						{
							measure: "referendum-vote-share",
							members: { "referendum-answer": answer },
							value: number(
								answer === "remain"
									? "Pct_Remain"
									: "Pct_Leave",
							),
						},
					]),
				],
			});
		},
	);
	return [{ key: "2016", records }];
}
