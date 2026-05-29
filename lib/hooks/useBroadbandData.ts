// Ofcom Connected Nations local authority fixed broadband coverage data
// Source: https://www.ofcom.org.uk/research-and-data/telecoms-research/connected-nations
// File: 202507_fixed_laua_coverage_r01.csv
import { BroadbandDataset, BroadbandLADData } from "../types/broadband";
import { withCDN } from "../helpers/cdn";
import { parseCsv } from "../helpers/parseCsv";
import { useDataLoader } from "./useDataLoader";

const YEAR = 2025;
const BOUNDARY_YEAR = 2024;

const parseNum = (v: any): number | null => {
	if (!v || v === "" || v === "N/A" || v === "-" || v === "..") return null;
	const n = parseFloat(String(v).replace(/,/g, "").replace(/%/, "").trim());
	return isNaN(n) ? null : n;
};

export const useBroadbandData = (enabled = true) => {
	return useDataLoader<BroadbandDataset>(async () => {
		const res = await fetch(
			withCDN("/data/telecoms/broadband/202507_fixed_laua_coverage_r01.csv"),
		);
		if (!res.ok)
			throw new Error(`Failed to fetch broadband data: ${res.statusText}`);

		const { data } = await parseCsv<Record<string, string>>(
			await res.text(),
			{ header: true },
		);

		const records: Record<string, BroadbandLADData> = {};

		for (const row of data as Record<string, string>[]) {
			const code = (row["laua"] ?? "").trim();
			const name = (row["laua_name"] ?? "").trim();
			if (!code || !name) continue;
			if (!/^[EWSN][0-9]/.test(code)) continue;

			records[code] = {
				ladCode: code,
				ladName: name,
				pctSuperfast: parseNum(row["SFBB availability (% premises)"]),
				pctUltrafast: parseNum(row["UFBB (100Mbit/s) availability (% premises)"]),
				pctFullFibre: parseNum(row["Full Fibre availability (% premises)"]),
				pctGigabit: parseNum(row["Gigabit availability (% premises)"]),
			};
		}

		const dataset: BroadbandDataset = {
			id: `broadband${YEAR}`,
			type: "broadband",
			year: YEAR,
			boundaryType: "localAuthority",
			boundaryYear: BOUNDARY_YEAR,
			data: records,
		};

		return { [YEAR]: dataset };
	}, enabled);
};
