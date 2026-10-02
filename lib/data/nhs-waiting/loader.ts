import { NHSWaitingDataset, NHSWaitingICBData } from "@/lib/types/nhsWaiting";
import { LAD_TO_ICB } from "./ladToIcb";
import { parseNumOrZero } from "@/lib/helpers/parseNumber";

// Column names for weekly bands ≥18 weeks
function isOver18WeeksBand(col: string): boolean {
	const m = col.match(/^Gt (\d+) To \d+ Weeks SUM 1$|^Gt (\d+) Weeks SUM 1$/);
	if (!m) return false;
	const week = parseInt(m[1] ?? m[2]);
	return week >= 18;
}

export async function loadNHSWaiting(
	readRows: (
		path: string,
		visit: (row: Readonly<Record<string, string>>) => void,
	) => Promise<void>,
): Promise<Record<string, NHSWaitingDataset>> {
	const icbTotals: Record<
		string,
		{ icbName: string; total: number; over18: number }
	> = {};
	let over18Cols: string[] | undefined;
	await readRows("health/nhs-waiting-times/rtt-mar-2026.zip", (row) => {
		// Identify over-18-week band columns from the first parsed row.
		over18Cols ??= Object.keys(row).filter(isOver18WeeksBand);
		if (row["RTT Part Description"] !== "Incomplete Pathways") return;

		const icbCode = (row["Provider Parent Org Code"] ?? "").trim();
		const icbName = (row["Provider Parent Name"] ?? "").trim();
		if (!icbCode || !icbName) return;

		const total = parseNumOrZero(row["Total All"]);
		const over18 = over18Cols.reduce(
			(sum, col) => sum + parseNumOrZero(row[col]),
			0,
		);

		if (!icbTotals[icbCode])
			icbTotals[icbCode] = { icbName, total: 0, over18: 0 };
		icbTotals[icbCode].total += total;
		icbTotals[icbCode].over18 += over18;
	});

	if (!over18Cols) return {};

	const icbData: Record<string, NHSWaitingICBData> = {};
	for (const [code, { icbName, total, over18 }] of Object.entries(
		icbTotals,
	)) {
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
