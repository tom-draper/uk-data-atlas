"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/docs/Page";
import { saveTable, type SourceFile } from "@/lib/fix/download";
import type { Diagnosis } from "@/lib/fix/diagnose";
import type { FileFormat } from "@/lib/fix/spreadsheet";
import { ROW_LIMIT, type Table } from "@/lib/fix/table";
import { changeCounts, correctedTable, rowUpdates } from "@/lib/fix/update";
import DiagnosisPanel from "./DiagnosisPanel";
import { Button, DownloadButtons } from "./ui";

const count = (value: number) => value.toLocaleString("en-GB");

export default function ResultSummary({
	source,
	table,
	diagnosis,
	area,
}: {
	source: SourceFile;
	table: Table;
	diagnosis: Diagnosis;
	area: number;
}) {
	const [status, setStatus] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [showIssues, setShowIssues] = useState(false);

	const { counts, preview } = useMemo(() => {
		const updates = diagnosis.latest ? rowUpdates(diagnosis) : null;
		const examples = new Map<string, number>();
		for (const result of diagnosis.results) {
			if (!table.rows[result.row]) continue;
			const change = updates?.get(result.row)?.change;
			const matched = updates
				? change === "current"
				: result.status === "matched" || result.status === "valid";
			const outcome = matched
				? "matched"
				: change === "updated" || change === "split"
					? change
					: "unresolved";
			if (!examples.has(outcome)) examples.set(outcome, result.row);
		}

		return {
			counts: updates ? changeCounts(updates) : null,
			preview: correctedTable(table, diagnosis, area, examples.values()),
		};
	}, [table, diagnosis, area]);
	const matched = counts?.current ?? diagnosis.matched;
	const updated = counts?.updated ?? 0;
	const splits = counts?.split ?? 0;
	const needsReview = table.rows.length - matched - updated;
	const unresolved = needsReview - splits;
	// The export adds columns immediately after the selected area column.
	const previewEnd = area + 1 + preview.headers.length - table.headers.length;

	async function download(format: FileFormat) {
		setBusy(true);
		setError(null);
		setStatus("Preparing your file…");
		try {
			await saveTable(
				source,
				correctedTable(table, diagnosis, area),
				"corrected",
				format,
			);
			setStatus("Your corrected file is downloading.");
		} catch (caught) {
			setStatus("");
			setError((caught as Error).message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<Card className="p-4 sm:p-5">
				<p className="text-[18px] font-semibold text-slate-900">
					{count(matched)} matched, {count(updated)} updated,{" "}
					{count(needsReview)} {needsReview === 1 ? "needs" : "need"}{" "}
					review
				</p>
				<p className="mt-1 text-[14px] text-slate-600">
					{diagnosis.releaseLabel
						? `Checked against ${diagnosis.releaseLabel}.`
						: "No matching boundary release found."}
					{diagnosis.latestLabel &&
						diagnosis.latestLabel !== diagnosis.releaseLabel &&
						` Corrections use ${diagnosis.latestLabel}.`}
					{diagnosis.inferred &&
						diagnosis.tiedWith.length > 0 &&
						" Other releases also match. You can choose a release above."}
				</p>
				<p className="mt-2 text-[14px] text-slate-600">
					{count(table.rows.length)}{" "}
					{table.rows.length === 1 ? "row" : "rows"} and all input
					columns.
					{source.format !== "csv" &&
						` Only the “${source.sheetName}” sheet is included, as cell values.`}
				</p>
				{table.droppedRows > 0 && (
					<p className="mt-1 text-[14px] font-medium text-amber-900">
						Partial download. The {count(ROW_LIMIT)}-row limit
						leaves out {count(table.droppedRows)}{" "}
						{table.droppedRows === 1 ? "row" : "rows"}.
					</p>
				)}
				{(splits > 0 || unresolved > 0) && (
					<ul className="mt-1 list-disc pl-5 text-[14px] text-slate-600">
						{splits > 0 && (
							<li>
								{count(splits)}{" "}
								{splits === 1 ? "row has" : "rows have"}{" "}
								multiple successors. The original values stay in
								place and the export lists the possible codes.
							</li>
						)}
						{unresolved > 0 && (
							<li>
								{count(unresolved)} unresolved{" "}
								{unresolved === 1
									? "row keeps its"
									: "rows keep their"}{" "}
								original value.
							</li>
						)}
					</ul>
				)}
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<DownloadButtons
						format={source.format}
						label={
							counts
								? "Download corrected file"
								: "Download checked file"
						}
						onDownload={download}
						disabled={busy}
					/>
					<Button
						aria-expanded={showIssues}
						aria-controls="fix-issues"
						onClick={() => setShowIssues((open) => !open)}
					>
						{showIssues ? "Hide issues" : "Review issues"}
					</Button>
					<span role="status" className="text-[13px] text-slate-600">
						{status}
					</span>
				</div>
				{error && (
					<p role="alert" className="mt-2 text-[13px] text-rose-700">
						{error}
					</p>
				)}
				<div className="mt-4 overflow-x-auto rounded-md border border-slate-900/10">
					<table className="w-full text-left text-[13px]">
						<caption className="px-3 py-2 text-left text-[14px] font-medium text-slate-900">
							Download preview
							<span className="ml-2 font-normal text-slate-600">
								Area columns from {count(preview.rows.length)}{" "}
								{preview.rows.length === 1
									? "example row"
									: "example rows"}
							</span>
						</caption>
						<thead className="bg-slate-100 text-slate-700">
							<tr>
								{preview.headers
									.slice(area, previewEnd)
									.map((header, index) => (
										<th
											key={index}
											scope="col"
											className="whitespace-nowrap px-3 py-2 font-mono font-medium"
										>
											{header}
										</th>
									))}
							</tr>
						</thead>
						<tbody>
							{preview.rows.map((row, rowIndex) => (
								<tr
									key={rowIndex}
									className="border-t border-slate-900/10"
								>
									{row
										.slice(area, previewEnd)
										.map((value, index) => (
											<td
												key={index}
												className="min-w-20 max-w-60 px-3 py-2 align-top break-words whitespace-pre-wrap"
											>
												{value}
											</td>
										))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Card>
			<div id="fix-issues" className="mt-3" hidden={!showIssues}>
				{showIssues && <DiagnosisPanel diagnosis={diagnosis} />}
			</div>
		</>
	);
}
