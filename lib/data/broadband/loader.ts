import { BroadbandDataset, BroadbandLADData } from "@/lib/types/broadband";
import { parseCsv } from "@/lib/helpers/parseCsv";

const YEAR = 2025;
const BOUNDARY_YEAR = 2024;

const parseNum = (v: any): number | null => {
	if (!v || v === "" || v === "N/A" || v === "-" || v === "..") return null;
	const n = parseFloat(String(v).replace(/,/g, "").replace(/%/, "").trim());
	return isNaN(n) ? null : n;
};

export async function loadBroadband(
	read: (path: string) => Promise<string>,
): Promise<Record<string, BroadbandDataset>> {
	const { data } = await parseCsv<Record<string, string>>(
		await read("telecoms/broadband/202507_fixed_laua_coverage_r01.csv"),
		{ header: true },
	);

	const records: Record<string, BroadbandLADData> = {};
	for (const row of data as Record<string, string>[]) {
		const code = (row["laua"] ?? "").trim();
		const name = (row["laua_name"] ?? "").trim();
		if (!code || !name || !/^[EWSN][0-9]/.test(code)) continue;

		records[code] = {
			ladCode: code,
			ladName: name,
			pctSuperfast: parseNum(row["SFBB availability (% premises)"]),
			pctUltrafast: parseNum(row["UFBB (100Mbit/s) availability (% premises)"]),
			pctFullFibre: parseNum(row["Full Fibre availability (% premises)"]),
			pctGigabit: parseNum(row["Gigabit availability (% premises)"]),
		};
	}

	return {
		[YEAR]: {
			id: `broadband${YEAR}`,
			type: "broadband",
			year: YEAR,
			boundaryType: "localAuthority",
			boundaryYear: BOUNDARY_YEAR,
			data: records,
		},
	};
}
