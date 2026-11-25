"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import CodePanel from "@/components/docs/CodePanel";
import { Card } from "@/components/docs/Page";
import { boundaryReleases } from "@/lib/fix/api";
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
import type { BoundaryRelease, ReleaseRef } from "@/lib/fix/types";
import { withHeader, withSheet, type Upload } from "@/lib/fix/upload";
import ColumnsPanel, { type ColumnChoice } from "./ColumnsPanel";
import ConvertPanel from "./ConvertPanel";
import InputPanel from "./InputPanel";
import MapPanel from "./MapPanel";
import ResultSummary from "./ResultSummary";
import UpdatePanel from "./UpdatePanel";
import { Button, DownloadButtons, OptionalPanel, StepHeading } from "./ui";

export default function FixTool() {
	const [source, setSource] = useState<Upload | null>(null);
	const [choice, setChoice] = useState<ColumnChoice>({
		area: null,
		parent: null,
		values: [],
	});
	const [release, setRelease] = useState<ReleaseRef | null>(null);
	const [releases, setReleases] = useState<BoundaryRelease[]>([]);
	const [result, setResult] = useState<CheckResult | null>(null);
	const [progress, setProgress] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [inputError, setInputError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const columns = useRef<HTMLElement>(null);
	const resultHeading = useRef<HTMLHeadingElement>(null);
	const activeCheck = useRef<AbortController | null>(null);
	const hasSource = source !== null;

	useEffect(() => () => activeCheck.current?.abort(), []);

	useEffect(() => {
		if (!hasSource) return;
		let active = true;
		void boundaryReleases()
			.then((available) => {
				if (active) setReleases(available);
			})
			.catch(() => {
				// Checking areas will retry the request and show any error.
			});
		return () => {
			active = false;
		};
	}, [hasSource]);

	useEffect(() => {
		if (result) resultHeading.current?.focus();
	}, [result]);

	function resetResult() {
		activeCheck.current?.abort();
		activeCheck.current = null;
		setResult(null);
		setError(null);
		setProgress("");
		setBusy(false);
	}

	function selectSource(upload: Upload) {
		resetResult();
		setRelease(null);
		const { area, parent, values } = detectColumns(upload.table);
		setSource(upload);
		setChoice({ area, parent, values });
	}

	function load(upload: Upload) {
		setInputError(null);
		selectSource(upload);
		requestAnimationFrame(() => {
			columns.current?.focus({ preventScroll: true });
			columns.current?.scrollIntoView({ block: "start" });
		});
	}

	const area = choice.area;
	async function checkAreas() {
		if (
			!source ||
			area === null ||
			source.table.rows.length === 0 ||
			activeCheck.current
		)
			return;
		const controller = new AbortController();
		activeCheck.current = controller;
		setResult(null);
		setBusy(true);
		setError(null);
		try {
			const checked = await runCheck(
				{
					table: source.table,
					area,
					kind: columnKind(source.table, area),
					parent: choice.parent,
					release,
				},
				controller.signal,
				(message) => {
					if (!controller.signal.aborted) setProgress(message);
				},
			);
			if (controller.signal.aborted) return;
			setResult(checked);
			setReleases(checked.releases);
			setProgress(
				`Checked ${checked.diagnosis.total.toLocaleString("en-GB")} rows.`,
			);
		} catch (caught) {
			if (controller.signal.aborted) return;
			setProgress("");
			setError((caught as Error).message);
		} finally {
			if (!controller.signal.aborted) {
				activeCheck.current = null;
				setBusy(false);
			}
		}
	}

	const table = source?.table;
	const diagnosis = result?.diagnosis;
	const file: SourceFile | null = source && {
		name: source.name,
		format: source.format,
		sheetName: source.sheets[source.sheet]?.name ?? "Sheet1",
	};

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
				<InputPanel
					onUpload={load}
					onError={setInputError}
					busy={busy}
				/>
			</section>

			<div aria-live="polite" className="sr-only">
				{progress}
			</div>
			{inputError && (
				<div
					role="alert"
					className="rounded-md border border-rose-600/20 bg-rose-50 px-4 py-3 text-[14px] text-rose-800"
				>
					<strong className="font-semibold">Problem: </strong>
					{inputError}
				</div>
			)}

			<div className="space-y-10">
				{source && table && (
					<section
						ref={columns}
						tabIndex={-1}
						aria-labelledby="fix-columns"
						className="scroll-mt-6 focus:outline-none"
					>
						<StepHeading
							step={2}
							id="fix-columns"
							aside={`${source.name}, ${table.rows.length.toLocaleString("en-GB")} rows`}
						>
							Review your data
						</StepHeading>
						<ColumnsPanel
							source={source}
							choice={choice}
							onChoice={(next) => {
								if (
									next.area !== area ||
									next.parent !== choice.parent
								)
									resetResult();
								setChoice(next);
							}}
							release={release}
							onRelease={(next) => {
								resetResult();
								setRelease(next);
							}}
							releases={releases}
							detectedGeography={
								diagnosis?.release?.geography ?? null
							}
							disabled={busy}
							onSheet={(sheet) =>
								selectSource(withSheet(source, sheet))
							}
							onHeader={(headerRow) =>
								selectSource(withHeader(source, headerRow))
							}
						/>
						{table.droppedRows > 0 && (
							<p className="mt-3 text-[14px] text-slate-600">
								Only the first{" "}
								{ROW_LIMIT.toLocaleString("en-GB")} rows will be
								checked.{" "}
								{table.droppedRows.toLocaleString("en-GB")} more
								were left out.
							</p>
						)}
						{error && (
							<p
								role="alert"
								className="mt-3 text-[14px] text-rose-800"
							>
								{error}
							</p>
						)}
						<div className="mt-4 flex flex-wrap items-center gap-3">
							<Button
								variant="primary"
								onClick={checkAreas}
								disabled={
									busy ||
									area === null ||
									table.rows.length === 0
								}
							>
								{busy
									? "Checking areas…"
									: result
										? "Check again"
										: "Check areas"}
							</Button>
							{table.rows.length === 0 ? (
								<p className="text-[14px] text-slate-600">
									{table.headerOptions.length > 0
										? "No data below this header. Choose a different header or use the first row as data."
										: "No data in this selection."}
								</p>
							) : (
								area === null && (
									<p className="text-[14px] text-slate-600">
										Choose the area column to check.
									</p>
								)
							)}
						</div>
					</section>
				)}

				{source && (busy || diagnosis) && (
					<section aria-labelledby="fix-diagnosis" aria-busy={busy}>
						<h2
							ref={resultHeading}
							id="fix-diagnosis"
							tabIndex={-1}
							className="mb-3 scroll-mt-6 text-[19px] font-semibold tracking-tight text-slate-900 focus:outline-none"
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
