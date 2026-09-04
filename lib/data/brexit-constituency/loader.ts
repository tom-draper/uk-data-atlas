import { BrexitConstituencyDataset, BrexitConstituencyData } from "@/lib/types";
import { parseCsv } from "@/lib/helpers/parseCsv";
import { parsePct } from "@/lib/helpers/parseNumber";

export async function loadBrexitConstituency(
	read: (path: string) => Promise<string>,
): Promise<Record<string, BrexitConstituencyDataset>> {
	const { data } = await parseCsv<string[]>(
		await read(
			"politics/referendum/constituencies/2016/eureferendum_constitunecy.csv",
		),
		{ header: false },
	);

	const records: Record<string, BrexitConstituencyData> = {};
	const resultMap: Record<string, "remain" | "leave"> = {};

	for (const row of data as string[][]) {
		const code = row[1]?.trim() || "";
		if (!code.startsWith("E14")) continue;

		const pctLeave = parsePct(row[6]);
		const isKnownResult = row[4]?.trim().toLowerCase() === "yes";

		records[code] = {
			constituencyCode: code,
			constituencyName: row[2]?.trim() || "",
			pctLeave,
			isKnownResult,
		};
		resultMap[code] = pctLeave > 50 ? "leave" : "remain";
	}

	const dataset: BrexitConstituencyDataset = {
		id: "brexitConstituency2016",
		year: 2016,
		type: "brexitConstituency",
		boundaryType: "constituency",
		boundaryYear: 2015,
		data: records,
		results: resultMap,
	};

	return { [dataset.year]: dataset };
}
