"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import CodePanel from "@/components/docs/CodePanel";
import { Card } from "@/components/docs/Page";
import { runCheck, type CheckResult } from "@/lib/fix/check";
import { columnKind, detectColumns } from "@/lib/fix/detect";
import { saveTable, type SourceFile } from "@/lib/fix/download";
import {
	checkedTable,
	codesCsv,
	derivedName,
	downloadText,
	matchReportCsv,
	validateCurl,
} from "@/lib/fix/report";
import type { FileFormat } from "@/lib/fix/spreadsheet";
import { ROW_LIMIT } from "@/lib/fix/table";
import type { ReleaseRef } from "@/lib/fix/types";
import { withSheet, type Upload } from "@/lib/fix/upload";
import ColumnsPanel, { type ColumnChoice } from "./ColumnsPanel";
import ConvertPanel from "./ConvertPanel";
import InputPanel from "./InputPanel";
import MapPanel from "./MapPanel";
import ResultSummary from "./ResultSummary";
import UpdatePanel from "./UpdatePanel";
import { Button, DownloadButtons, OptionalPanel, StepHeading } from "./ui";

/**
 * The fix-your-data tool. A file goes in, its columns are detected, and the
 * area column is checked against the API as soon as it is known, and again
 * whenever the user changes what was detected.
 */
export default function FixTool() {
	const [source, setSource] = useState<Upload | null>(null);
	const [choice, setChoice] = useState<ColumnChoice>({
		area: null,
		parent: null,
		values: [],
	});
	const [release, setRelease] = useState<ReleaseRef | null>(null);
	const [result, setResult] = useState<CheckResult | null>(null);
	const [progress, setProgress] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const results = useRef<HTMLDivElement>(null);

	function load(upload: Upload) {
		const { table } = upload;
		setResult(null);
		setRelease(null);
		if (table.rows.length === 0) {
			setSource(null);
			setError(
				"No rows found. Check the file has a header row and at least one row of data.",
			);
			return;
		}
		const detection = detectColumns(table);
		setError(
			detection.area === null
				? "No column of area codes or names was found. Choose the area column below."
				: null,
		);
		setSource(upload);
		setChoice({
			area: detection.area ?? null,
			parent: detection.parent,
			values: detection.values,
		});
		requestAnimationFrame(() =>
			results.current?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			}),
		);
	}

	const area = choice.area;
	const parent = choice.parent;
	useEffect(() => {
		if (!source || area === null) return;
		const controller = new AbortController();
		setBusy(true);
		setError(null);
		runCheck(
			{
				table: source.table,
				area,
				kind: columnKind(source.table, area),
				parent,
				release,
			},
			controller.signal,
			setProgress,
		)
			.then((checked) => {
				setResult(checked);
				setProgress(
					`Checked ${checked.diagnosis.total.toLocaleString("en-GB")} rows.`,
				);
			})
			.catch((caught: Error) => {
				if (caught.name === "AbortError") return;
				setResult(null);
				setProgress("");
				setError(caught.message);
			})
			.finally(() => {
				if (!controller.signal.aborted) setBusy(false);
			});
		return () => controller.abort();
	}, [source, area, parent, release]);

	const table = source?.table;
	const diagnosis = result?.diagnosis;
	const file: SourceFile | null = source && {
		name: source.name,
		format: source.format,
		sheetName: source.sheets[source.sheet]?.name ?? "Sheet1",
	};

	function chooseSheet(sheet: number) {
		if (!source) return;
		const next = withSheet(source, sheet);
		const detection = detectColumns(next.table);
		setResult(null);
		setRelease(null);
		setError(
			next.table.rows.length === 0
				? "That sheet has no rows. Choose another sheet."
				: detection.area === null
					? "No column of area codes or names was found. Choose the area column below."
					: null,
		);
		setSource(next);
		setChoice({
			area: detection.area ?? null,
			parent: detection.parent,
			values: detection.values,
		});
	}

	async function downloadChecked(format: FileFormat) {
		if (!file || !table || !diagnosis || area === null) return;
		try {
			await saveTable(
				file,
				checkedTable(table, diagnosis, area),
				"checked",
				format,
			);
		} catch (caught) {
			setError((caught as Error).message);
		}
	}

	return (
		<div className="space-y-10">
			<section aria-labelledby="fix-input">
				<StepHeading step={1} id="fix-input">
					Add your data
				</StepHeading>
				<InputPanel onUpload={load} onError={setError} busy={busy} />
			</section>

			<div aria-live="polite" className="sr-only">
				{progress}
			</div>
			{error && (
				<div
					role="alert"
					className="rounded-md border border-rose-600/20 bg-rose-50 px-4 py-3 text-[14px] text-rose-800"
				>
					<strong className="font-semibold">Problem: </strong>
					{error}
				</div>
			)}

			<div ref={results} className="scroll-mt-6 space-y-10">
				{source && table && (
					<section aria-labelledby="fix-columns">
						<StepHeading
							step={2}
							id="fix-columns"
							aside={`${source.name}, ${table.rows.length.toLocaleString("en-GB")} rows`}
						>
							Columns we found
						</StepHeading>
						{source.sheets.length > 1 && (
							<div className="mb-3 flex flex-wrap items-center gap-2 text-[14px] text-slate-700">
								<label
									htmlFor="fix-sheet"
									className="font-medium"
								>
									Sheet
								</label>
								<select
									id="fix-sheet"
									value={source.sheet}
									disabled={busy}
									onChange={(event) =>
										chooseSheet(Number(event.target.value))
									}
									className="min-h-10 rounded-md border border-slate-900/15 bg-white px-2 text-[14px] text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
								>
									{source.sheets.map((sheet, index) => (
										<option key={index} value={index}>
											{sheet.name}
											{sheet.hidden ? " (hidden)" : ""}
											{sheet.empty ? " (empty)" : ""}
										</option>
									))}
								</select>
								<span className="text-slate-500">
									Your file has {source.sheets.length} sheets.
									A download keeps the sheet you choose.
								</span>
							</div>
						)}
						{(table.droppedRows > 0 || table.skippedLines > 0) && (
							<p className="mb-3 text-[14px] text-slate-600">
								{table.skippedLines > 0 &&
									`Skipped ${table.skippedLines} line${table.skippedLines === 1 ? "" : "s"} above the header. `}
								{table.droppedRows > 0 &&
									`Only the first ${ROW_LIMIT.toLocaleString("en-GB")} rows are checked; ${table.droppedRows.toLocaleString("en-GB")} more were left out.`}
							</p>
						)}
						<ColumnsPanel
							table={table}
							choice={choice}
							onChoice={setChoice}
							release={release}
							onRelease={setRelease}
							releases={result?.releases ?? []}
							detectedGeography={
								diagnosis?.release?.geography ?? null
							}
							disabled={busy}
						/>
					</section>
				)}

				{source && (busy || diagnosis) && (
					<section aria-labelledby="fix-diagnosis" aria-busy={busy}>
						<h2
							id="fix-diagnosis"
							className="mb-3 text-[19px] font-semibold tracking-tight text-slate-900"
						>
							What we found
						</h2>
						{busy ? (
							<Card className="p-5">
								<p className="text-[15px] text-slate-600">
									{progress || "Checking…"}
								</p>
							</Card>
						) : (
							diagnosis &&
							file &&
							table &&
							area !== null && (
								<ResultSummary
									source={file}
									table={table}
									diagnosis={diagnosis}
									area={area}
								/>
							)
						)}
					</section>
				)}

				{source &&
					file &&
					table &&
					result &&
					diagnosis &&
					!busy &&
					area !== null && (
						<div className="space-y-2">
							{diagnosis.release && diagnosis.matched > 0 && (
								<OptionalPanel id="fix-map" label="Map preview">
									<MapPanel
										key={`${source.name}/${source.sheet}/${area}/${diagnosis.release.boundaryRelease}`}
										table={table}
										diagnosis={diagnosis}
										values={choice.values}
									/>
								</OptionalPanel>
							)}

							{diagnosis.latest && diagnosis.matched > 0 && (
								<OptionalPanel
									id="fix-update"
									label="Update and add columns"
								>
									<UpdatePanel
										key={`${source.name}/${source.sheet}/${area}/${diagnosis.release?.boundaryRelease}`}
										table={table}
										diagnosis={diagnosis}
										area={area}
										source={file}
									/>
								</OptionalPanel>
							)}

							{diagnosis.release && diagnosis.matched > 0 && (
								<OptionalPanel
									id="fix-convert"
									label="Convert to another geography"
								>
									<ConvertPanel
										key={`${source.name}/${source.sheet}/${area}/${diagnosis.release.boundaryRelease}/${choice.values.join(",")}`}
										table={table}
										diagnosis={diagnosis}
										values={choice.values}
										source={file}
									/>
								</OptionalPanel>
							)}

							<OptionalPanel id="fix-output" label="Reports">
								<div className="flex flex-wrap gap-2">
									<DownloadButtons
										format={source.format}
										label="Your file, with each area's status"
										onDownload={downloadChecked}
									/>
									<Button
										onClick={() =>
											downloadText(
												matchReportCsv(diagnosis),
												derivedName(
													source.name,
													"match-report",
												),
											)
										}
									>
										<Download
											aria-hidden="true"
											className="h-4 w-4"
										/>
										Match report (.csv)
									</Button>
								</div>

								<h3 className="mt-8 mb-2 text-[15px] font-semibold text-slate-900">
									Do this from code
								</h3>
								<p className="mb-3 max-w-[680px] text-[14px] text-slate-600">
									The same check is one request to the API.
									Send the area column as a CSV headed{" "}
									<code className="font-mono text-[13px]">
										area
									</code>
									{result.body.parents ? (
										<>
											, with a{" "}
											<code className="font-mono text-[13px]">
												parent
											</code>{" "}
											column
										</>
									) : null}
									.{" "}
									<button
										type="button"
										className="cursor-pointer font-medium text-slate-800 underline decoration-slate-300 underline-offset-[3px] hover:decoration-slate-700"
										onClick={() =>
											downloadText(
												codesCsv(
													result.body.values,
													result.body.parents,
												),
												"areas.csv",
											)
										}
									>
										Download areas.csv
									</button>
								</p>
								<CodePanel
									title="Check the column"
									language="curl"
									code={validateCurl(release)}
								/>
							</OptionalPanel>
						</div>
					)}
			</div>
		</div>
	);
}
