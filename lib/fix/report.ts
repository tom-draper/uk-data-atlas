import { API_BASE_URL } from "@/lib/site";
import type { Diagnosis, RowResult } from "./diagnose";
import { freeHeader, writeCsv, type Table } from "./table";
import type { ReleaseRef } from "./types";

/**
 * The files and request the page hands back. The match report keeps the
 * columns of the API's own `format=csv` report, so the two can be compared,
 * and adds the file's line number and what retired codes became.
 */

const STATUS_WORDS: Record<RowResult["status"], string> = {
	valid: "valid",
	matched: "matched",
	superseded: "older release",
	"not-yet-current": "newer release",
	"absent-from-release": "missing from release",
	"other-geography": "other kind of area",
	unknown: "not recognised",
	"malformed-code": "not a valid code",
	ambiguous: "more than one match",
	unmatched: "not recognised",
	empty: "empty",
};

/** A short word for a row's status, for the file and the table on screen. */
export function statusWord(result: RowResult): string {
	if (
		result.latestStatus === "superseded" &&
		(result.status === "valid" || result.status === "matched")
	)
		return "retired";
	return STATUS_WORDS[result.status];
}

const successorText = (result: RowResult) =>
	result.successors?.map((s) => s.code).join(" | ") ?? "";

export function matchReportCsv(diagnosis: Diagnosis): string {
	const headers = [
		"line",
		"atlasRelease",
		"inputSha256",
		"likelyGeography",
		"likelyRelease",
		"latestRelease",
		"value",
		"status",
		"latestStatus",
		"areaCode",
		"areaName",
		"successorCodes",
		"duplicateOfLine",
		"detail",
	];
	const rows = diagnosis.results.map((result) => [
		String(result.row + 2),
		diagnosis.atlasRelease ?? "",
		diagnosis.inputSha256 ?? "",
		diagnosis.release?.geography ?? "",
		diagnosis.release?.boundaryRelease ?? "",
		diagnosis.latest?.boundaryRelease ?? "",
		result.value,
		result.status,
		result.latestStatus ?? "",
		result.area?.code ?? "",
		result.area?.name ?? "",
		successorText(result),
		result.duplicateOf !== undefined ? String(result.duplicateOf + 2) : "",
		result.detail ?? "",
	]);
	return writeCsv(headers, rows);
}

/** The user's file with a status and area name added after the area column. */
export function checkedCsv(
	table: Table,
	diagnosis: Diagnosis,
	area: number,
): string {
	const byRow = new Map(diagnosis.results.map((r) => [r.row, r]));
	const status = freeHeader(table.headers, "area_status");
	const name = freeHeader(table.headers, "area_name");
	const headers = [
		...table.headers.slice(0, area + 1),
		status,
		name,
		...table.headers.slice(area + 1),
	];
	const rows = table.rows.map((row, index) => {
		const result = byRow.get(index);
		return [
			...row.slice(0, area + 1),
			result ? statusWord(result) : "",
			result?.area?.name ?? "",
			...row.slice(area + 1),
		];
	});
	return writeCsv(headers, rows);
}

/** The area column on its own, headed as `/areas:validate` reads CSV. */
export function codesCsv(values: string[], parents?: string[]): string {
	return parents
		? writeCsv(
				["area", "parent"],
				values.map((value, i) => [value, parents[i] ?? ""]),
			)
		: writeCsv(
				["area"],
				values.map((value) => [value]),
			);
}

/** The request that repeats the check, for automating it. */
export function validateCurl(release: ReleaseRef | null, file = "areas.csv") {
	const query = release
		? `?geography=${release.geography}&release=${release.boundaryRelease}`
		: "";
	return [
		`curl -sS -X POST '${API_BASE_URL}/areas:validate${query}' \\`,
		"  -H 'content-type: text/csv' \\",
		`  --data-binary @${file}`,
	].join("\n");
}

/** Offers text to the user as a file download. */
export function downloadText(
	text: string,
	filename: string,
	type = "text/csv;charset=utf-8",
) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "households.csv" becomes "households-checked.csv". */
export function derivedName(source: string, suffix: string): string {
	const base = source.replace(/\.[^.]+$/, "") || "data";
	return `${base}-${suffix}.csv`;
}
