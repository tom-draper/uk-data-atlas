"use client";

import { useState } from "react";
import { Card } from "@/components/docs/Page";
import { saveTable, type SourceFile } from "@/lib/fix/download";
import type { Diagnosis } from "@/lib/fix/diagnose";
import type { FileFormat } from "@/lib/fix/spreadsheet";
import type { Table } from "@/lib/fix/table";
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

	const counts = diagnosis.latest
		? changeCounts(rowUpdates(diagnosis))
		: null;
	const matched = counts?.current ?? diagnosis.matched;
	const updated = counts?.updated ?? 0;
	const needsReview = table.rows.length - matched - updated;

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
					{!!counts?.split &&
						` ${count(counts.split)} ${counts.split === 1 ? "row has" : "rows have"} multiple successors to review.`}
				</p>
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
			</Card>
			<div id="fix-issues" className="mt-3" hidden={!showIssues}>
				{showIssues && <DiagnosisPanel diagnosis={diagnosis} />}
			</div>
		</>
	);
}
