import { NHSWaitingDataset, NHSWaitingICBData } from "@/lib/types/nhsWaiting";
import { LAD_TO_ICB } from "./ladToIcb";
import { parseCsv } from "@/lib/helpers/parseCsv";

const toNum = (v: any): number => {
	const n = parseFloat(String(v ?? "").replace(/,/g, "").trim());
	return isNaN(n) ? 0 : n;
};

// Column names for weekly bands ≥18 weeks
function isOver18WeeksBand(col: string): boolean {
	const m = col.match(/^Gt (\d+) To \d+ Weeks SUM 1$|^Gt (\d+) Weeks SUM 1$/);
	if (!m) return false;
	const week = parseInt(m[1] ?? m[2]);
	return week >= 18;
}

export async function loadNHSWaiting(
	readZip: (path: string) => Promise<string>,
): Promise<Record<string, NHSWaitingDataset>> {
	const csv = await readZip("health/nhs-waiting-times/rtt-mar-2026.zip");
	const { data } = await parseCsv<Record<string, string>>(csv, { header: true });

	const icbTotals: Record<string, { icbName: string; total: number; over18: number }> = {};

	const rows = data as Record<string, string>[];
	if (rows.length === 0) return {};

	// Identify over-18-week band columns from first row's keys
	const over18Cols = Object.keys(rows[0]).filter(isOver18WeeksBand);

	for (const row of rows) {
		if (row["RTT Part Description"] !== "Incomplete Pathways") continue;

		const icbCode = (row["Provider Parent Org Code"] ?? "").trim();
		const icbName = (row["Provider Parent Name"] ?? "").trim();
		if (!icbCode || !icbName) continue;

		const total = toNum(row["Total"]);
		const over18 = over18Cols.reduce((sum, col) => sum + toNum(row[col]), 0);

		if (!icbTotals[icbCode]) icbTotals[icbCode] = { icbName, total: 0, over18: 0 };
		icbTotals[icbCode].total += total;
		icbTotals[icbCode].over18 += over18;
	}

	const icbData: Record<string, NHSWaitingICBData> = {};
	for (const [code, { icbName, total, over18 }] of Object.entries(icbTotals)) {
		if (total === 0) continue;
		icbData[code] = {
			icbCode: code,
			icbName,
			total,
			over18Weeks: over18,
			pctOver18Weeks: (over18 / total) * 100,
		};
	}

	return {
		2026: {
			id: "nhsWaiting2026",
			type: "nhsWaiting",
			year: 2026,
			month: "March 2026",
			boundaryType: "localAuthority",
			boundaryYear: 2024,
			data: icbData,
			ladToIcb: LAD_TO_ICB,
		},
	};
}
