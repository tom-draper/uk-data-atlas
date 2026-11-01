"use client";

import { useEffect, useId, useState } from "react";
import { Download } from "lucide-react";
import { Card } from "@/components/docs/Page";
import {
	boundaryReleases,
	convertCounts,
	crosswalks,
	validateAgainst,
} from "@/lib/fix/api";
import {
	convertChoices,
	convertedCsv,
	countInput,
	type ConvertChoice,
	type ConvertedColumn,
	type LeftOut,
} from "@/lib/fix/convert";
import type { Diagnosis } from "@/lib/fix/diagnose";
import { geographyLabel } from "@/lib/fix/releases";
import { derivedName, downloadText } from "@/lib/fix/report";
import type { Table } from "@/lib/fix/table";
import type { BoundaryRelease } from "@/lib/fix/types";
import { Button, Check, labelClass, selectClass, ToneIcon } from "./ui";

const count = (value: number) => value.toLocaleString("en-GB");
const rows = (value: number) => `${count(value)} row${value === 1 ? "" : "s"}`;

function Lines({ items }: { items: LeftOut[] }) {
	return (
		<details className="mt-1">
			<summary className="cursor-pointer text-[13px] text-slate-500 hover:text-slate-800">
				Show {rows(items.length)}
			</summary>
			<ul className="mt-1.5 space-y-0.5 text-[13px] text-slate-600">
				{items.slice(0, 100).map((item) => (
					<li key={item.line}>
						Line {item.line}, {item.value || "blank"}: {item.reason}
					</li>
				))}
				{items.length > 100 && (
					<li>And {count(items.length - 100)} more.</li>
				)}
			</ul>
		</details>
	);
}

interface Converted {
	choice: ConvertChoice;
	columns: ConvertedColumn[];
	names: Map<string, string>;
}

/**
 * Totals the file's counts on another geography, through a crosswalk the
 * API publishes from the release the file matched.
 */
export default function ConvertPanel({
	table,
	diagnosis,
	values,
	sourceName,
}: {
	table: Table;
	diagnosis: Diagnosis;
	/** The number columns chosen in step 2. */
	values: number[];
	sourceName: string;
}) {
	const [choices, setChoices] = useState<ConvertChoice[] | null>(null);
	const [allReleases, setReleases] = useState<BoundaryRelease[]>([]);
	const [failed, setFailed] = useState(false);
	const [target, setTarget] = useState("");
	const [picked, setPicked] = useState<number[]>(values);
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [converted, setConverted] = useState<Converted | null>(null);
	const id = useId();

	const from = diagnosis.release;
	useEffect(() => {
		if (!from) return;
		let live = true;
		Promise.all([crosswalks(), boundaryReleases()])
			.then(([all, releases]) => {
				if (!live) return;
				const found = convertChoices(from, all, releases);
				setReleases(releases);
				setChoices(found);
				setTarget(found[0]?.id ?? "");
			})
			.catch(() => {
				if (live) setFailed(true);
			});
		return () => {
			live = false;
		};
	}, [from]);

	if (failed)
		return (
			<Card className="p-4 sm:p-5">
				<p className="text-[15px] text-slate-700">
					The geographies to convert to couldn&apos;t be loaded.
					Reload the page to try again.
				</p>
			</Card>
		);
	if (!from) return null;
	if (!choices)
		return (
			<Card className="p-4 sm:p-5">
				<p className="text-[15px] text-slate-600">
					Finding geographies to convert to…
				</p>
			</Card>
		);
	if (choices.length === 0)
		return (
			<Card className="p-4 sm:p-5">
				<p className="text-[15px] text-slate-700">
					No published crosswalk converts {diagnosis.releaseLabel} to
					another geography yet.
				</p>
			</Card>
		);

	const choice = choices.find((entry) => entry.id === target) ?? choices[0];
	const sourceNoun = geographyLabel(
		allReleases,
		from.geography,
	).toLowerCase();
	const columns = picked.filter((index) => values.includes(index));
	const inputs = columns.map((index) => ({
		index,
		header: table.headers[index],
		...countInput(table, diagnosis, index),
	}));
	const repeats = inputs[0]?.repeats ?? [];
	const ready =
		inputs.length > 0 &&
		repeats.length === 0 &&
		inputs.every((input) => input.rows.length > 0);

	function reset() {
		setConverted(null);
		setStatus("");
		setError(null);
	}

	async function convert() {
		setBusy(true);
		reset();
		try {
			const results: ConvertedColumn[] = [];
			for (const input of inputs) {
				setStatus(`Converting ${input.header}…`);
				results.push({
					header: input.header,
					result: await convertCounts(
						choice.id,
						input.rows,
						choice.weighting,
					),
				});
			}
			setStatus("Reading area names…");
			const codes = [
				...new Set(
					results.flatMap((column) =>
						column.result.records.map((record) => record.areaCode),
					),
				),
			];
			const names = new Map<string, string>();
			if (codes.length > 0) {
				const checked = await validateAgainst(choice.to, {
					values: codes,
				});
				for (const value of checked.values)
					if (value.area) names.set(value.area.code, value.area.name);
			}
			setConverted({ choice, columns: results, names });
			setStatus("Converted. Your file is ready to download.");
		} catch (caught) {
			setStatus("");
			setError((caught as Error).message);
		} finally {
			setBusy(false);
		}
	}

	const records = converted?.columns[0]?.result.records ?? [];
	const partial = records.filter(
		(record) => record.coverage.status === "partial",
	).length;
	const estimated = converted?.columns.some(
		(column) => column.result.method !== "exact",
	);

	return (
		<Card className="p-4 sm:p-5">
			<p className="text-[15px] text-slate-700">
				Adds up your counts for each larger area your {sourceNoun} sit
				in, using the crosswalks published for{" "}
				<strong className="font-semibold text-slate-900">
					{diagnosis.releaseLabel}
				</strong>
				.
			</p>

			<div className="mt-4 grid gap-5 sm:grid-cols-2">
				<div>
					<label htmlFor={`${id}-target`} className={labelClass}>
						Convert to
					</label>
					<select
						id={`${id}-target`}
						className={selectClass}
						value={choice.id}
						disabled={busy}
						onChange={(event) => {
							setTarget(event.target.value);
							reset();
						}}
					>
						{choices.map((entry) => (
							<option key={entry.id} value={entry.id}>
								{entry.label}
							</option>
						))}
					</select>
					{choice.weighting && (
						<p className="mt-1.5 text-[13px] text-slate-500">
							Areas that cross a boundary are shared out by{" "}
							{choice.weighting}, so totals are estimates.
						</p>
					)}
				</div>

				<fieldset className="space-y-2">
					<legend className={labelClass}>Columns to add up</legend>
					{values.length === 0 ? (
						<p className="text-[14px] text-slate-600">
							No number columns. Tick them under &quot;Number
							columns&quot; in step 2.
						</p>
					) : (
						values.map((index) => (
							<Check
								key={index}
								checked={picked.includes(index)}
								onChange={(on) => {
									setPicked((current) =>
										on
											? [...current, index]
											: current.filter(
													(v) => v !== index,
												),
									);
									reset();
								}}
							>
								{table.headers[index]}
							</Check>
						))
					)}
					<p className="text-[13px] text-slate-500">
						Only counts that add up, such as people or households.
						Not rates, percentages or averages.
					</p>
				</fieldset>
			</div>

			{inputs.length > 0 && (
				<ul className="mt-5 space-y-2">
					{inputs.map((input) => (
						<li
							key={input.index}
							className="flex gap-2.5 text-[14px] text-slate-800"
						>
							<ToneIcon
								tone={input.leftOut.length > 0 ? "warn" : "ok"}
							/>
							<div>
								<span className="font-medium">
									{input.header}
								</span>
								: {rows(input.rows.length)} go in
								{input.leftOut.length > 0 &&
									`, ${rows(input.leftOut.length)} left out`}
								{input.leftOut.length > 0 && (
									<Lines items={input.leftOut} />
								)}
							</div>
						</li>
					))}
					{repeats.length > 0 && (
						<li className="flex gap-2.5 text-[14px] text-slate-800">
							<ToneIcon tone="error" />
							<div>
								{rows(repeats.length)} repeat an area already in
								the file. Combine or remove them, then check
								again.
								<Lines items={repeats} />
							</div>
						</li>
					)}
				</ul>
			)}

			<div className="mt-4 flex flex-wrap items-center gap-3">
				<Button
					variant={converted ? "secondary" : "primary"}
					onClick={convert}
					disabled={busy || !ready}
				>
					Convert
				</Button>
				{converted && (
					<Button
						variant="primary"
						onClick={() =>
							downloadText(
								convertedCsv(
									converted.columns,
									converted.choice.header,
									converted.names,
									sourceNoun,
								),
								derivedName(
									sourceName,
									`by-${converted.choice.header.replace(/_/g, "-")}`,
								),
							)
						}
					>
						<Download aria-hidden="true" className="h-4 w-4" />
						Download converted file
					</Button>
				)}
				<span role="status" className="text-[13px] text-slate-600">
					{status}
				</span>
			</div>

			{converted && (
				<ul className="mt-4 space-y-1.5">
					<li className="flex gap-2.5 text-[14px] text-slate-800">
						<ToneIcon tone="ok" />
						Totals for {count(records.length)}{" "}
						{records.length === 1 ? "area" : "areas"} in{" "}
						{converted.choice.label}
					</li>
					{partial > 0 && (
						<li className="flex gap-2.5 text-[14px] text-slate-800">
							<ToneIcon tone="warn" />
							<span>
								{count(partial)} {partial === 1 ? "is" : "are"}{" "}
								partial: your file has only some of the{" "}
								{sourceNoun} inside{" "}
								{partial === 1 ? "it" : "them"}, so{" "}
								{partial === 1
									? "its total is"
									: "their totals are"}{" "}
								too low. The file says how many.
							</span>
						</li>
					)}
					{estimated && (
						<li className="flex gap-2.5 text-[14px] text-slate-800">
							<ToneIcon tone="info" />
							Values are estimates and are not rounded.
						</li>
					)}
				</ul>
			)}

			{error && (
				<p
					role="alert"
					className="mt-3 rounded-md border border-rose-600/20 bg-rose-50 px-3 py-2 text-[14px] text-rose-800"
				>
					<strong className="font-semibold">Problem: </strong>
					{error}
				</p>
			)}
		</Card>
	);
}
