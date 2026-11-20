"use client";

import { useState } from "react";
import { Card } from "@/components/docs/Page";
import { saveTable, type SourceFile } from "@/lib/fix/download";
import type { Diagnosis } from "@/lib/fix/diagnose";
import type { FileFormat } from "@/lib/fix/spreadsheet";
import type { Table } from "@/lib/fix/table";
import { changeCounts, correctedTable, rowUpdates } from "@/lib/fix/update";
import { DownloadButtons } from "./ui";

const count = (value: number) => value.toLocaleString("en-GB");

/**
 * The page's main result: the user's own file, corrected, in one click.
 * Retired codes are replaced, names become codes, and nothing else in the
 * file moves. The steps below it are for choosing something other than this.
 */
export default function CorrectedDownload({
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

	const counts = diagnosis.latest
		? changeCounts(rowUpdates(diagnosis))
		: null;
	const changed = counts ? counts.updated + counts.split : 0;
	const kept = counts
		? counts["no-successor"] + counts["not-checked"] + counts["not-matched"]
		: 0;

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
		<Card className="mt-4 p-4 sm:p-5">
			<h3 className="text-[15px] font-semibold text-slate-900">
				Your corrected file
			</h3>
			<p className="mt-1 max-w-[680px] text-[14px] text-slate-600">
				{counts
					? `${count(table.rows.length)} rows with every column and its order kept. ${diagnosis.kind === "code" ? "Retired codes are replaced by what they became" : "Names are matched to area codes"}${changed > 0 ? ` (${count(changed)} row${changed === 1 ? "" : "s"} changed)` : ""}, with each area's name and a note of what changed beside it.${kept > 0 ? ` ${count(kept)} row${kept === 1 ? "" : "s"} we can't match keep what they had.` : ""}`
					: `${count(table.rows.length)} rows with every column and its order kept, and each area's status and name beside it.`}
				{source.format !== "csv" &&
					" It downloads as the same kind of file you added."}
			</p>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<DownloadButtons
					format={source.format}
					label="Download corrected file"
					onDownload={download}
					disabled={busy}
				/>
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
	);
}
