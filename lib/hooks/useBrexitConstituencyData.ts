import { BrexitConstituencyDataset, BrexitConstituencyData } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";
import { parsePct } from "../helpers/parseNumber";
import { useDataLoader } from "./useDataLoader";

export const useBrexitConstituencyData = (enabled = true) => {
	return useDataLoader<BrexitConstituencyDataset>(async () => {
		const response = await fetch(
			withCDN("/data/elections/referendum/eureferendum_constitunecy.csv"),
		);
		if (!response.ok)
			throw new Error(
				`Failed to fetch Brexit constituency data: ${response.statusText}`,
			);

		const { data } = await parseCsv<string[]>(await response.text(), {
			header: false,
		});

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
	}, enabled);
};
