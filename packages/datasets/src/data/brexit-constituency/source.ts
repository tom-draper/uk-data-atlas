import type { DirectPart } from "../../declaration/statistics.ts";
import { parseCsv } from "../../helpers/parseCsv.ts";
import { parsePct } from "../../helpers/parseNumber.ts";
import { sourceDir } from "../../declaration/sources.ts";

/**
 * Hanretty's estimate of the Leave share in each English constituency, as one
 * part keyed "2016". The estimates cover English constituencies only. A seat
 * whose result was counted by constituency is marked observed, the rest
 * estimated.
 */
export async function brexitConstituencyStatisticsParts(
	read: (path: string) => Promise<string>,
): Promise<DirectPart[]> {
	const { data } = await parseCsv<string[]>(
		await read(
			sourceDir("brexit-constituency", "eureferendum_constitunecy.xlsx"),
		),
		{ header: false },
	);
	const records: DirectPart["records"] = [];
	for (const row of data as string[][]) {
		const code = row[1]?.trim() || "";
		if (!code.startsWith("E14")) continue;
		records.push({
			code,
			name: row[2]?.trim() || "",
			values: [
				{
					measure: "referendum-vote-share",
					members: { "referendum-answer": "leave" },
					value: parsePct(row[6]!),
					status:
						row[4]?.trim().toLowerCase() === "yes"
							? "observed"
							: "estimated",
				},
			],
		});
	}
	return [{ key: "2016", records }];
}
