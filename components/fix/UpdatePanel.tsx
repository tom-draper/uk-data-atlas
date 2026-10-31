"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import { Card } from "@/components/docs/Page";
import {
	boundaryReleases,
	bulkLookups,
	crosswalks,
	lookupCsv,
} from "@/lib/fix/api";
import type { Diagnosis, Tone } from "@/lib/fix/diagnose";
import {
	parentChoices,
	readParentLookup,
	type ParentChoice,
} from "@/lib/fix/parents";
import { derivedName, downloadText } from "@/lib/fix/report";
import type { Successor } from "@/lib/fix/successors";
import type { Table } from "@/lib/fix/table";
import {
	changeCounts,
	rowUpdates,
	updatedCsv,
	type CodeMode,
	type SplitMode,
} from "@/lib/fix/update";
import { Button, labelClass, ToneIcon } from "./ui";

const count = (value: number) => value.toLocaleString("en-GB");
const rows = (value: number) => `${count(value)} row${value === 1 ? "" : "s"}`;

function Choice({
	name,
	value,
	checked,
	onChange,
	children,
	hint,
}: {
	name: string;
	value: string;
	checked: boolean;
	onChange: (value: string) => void;
	children: ReactNode;
	hint?: string;
}) {
	return (
		<label className="flex gap-2 text-[14px] text-slate-700">
			<input
				type="radio"
				name={name}
				value={value}
				checked={checked}
				onChange={() => onChange(value)}
				className="mt-[3px] h-4 w-4 shrink-0 accent-slate-900"
			/>
			<span>
				{children}
				{hint && (
					<span className="block text-[13px] text-slate-500">
						{hint}
					</span>
				)}
			</span>
		</label>
	);
}

function Check({
	checked,
	onChange,
	children,
	hint,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	children: ReactNode;
	hint?: string;
}) {
	return (
		<label className="flex gap-2 text-[14px] text-slate-700">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				className="mt-[3px] h-4 w-4 shrink-0 accent-slate-900"
			/>
			<span>
				{children}
				{hint && (
					<span className="block text-[13px] text-slate-500">
						{hint}
					</span>
				)}
			</span>
		</label>
	);
}

/** Parent lookups already read this visit, by crosswalk id. */
const parentCache = new Map<string, Promise<Map<string, Successor[]>>>();

function loadParents(choice: ParentChoice) {
	let lookup = parentCache.get(choice.id);
	if (!lookup) {
		lookup = lookupCsv(choice.href).then(readParentLookup);
		lookup.catch(() => parentCache.delete(choice.id));
		parentCache.set(choice.id, lookup);
	}
	return lookup;
}

/**
 * Moves the file's areas to the latest release and adds the columns the
 * user picks, then hands the file back. Shown only once a release matched.
 */
export default function UpdatePanel({
	table,
	diagnosis,
	area,
	sourceName,
}: {
	table: Table;
	diagnosis: Diagnosis;
	area: number;
	sourceName: string;
}) {
	const isCode = diagnosis.kind === "code";
	const [codes, setCodes] = useState<CodeMode>("add");
	const [splits, setSplits] = useState<SplitMode>("list");
	const [name, setName] = useState(true);
	const [choices, setChoices] = useState<ParentChoice[]>([]);
	const [choicesFailed, setChoicesFailed] = useState(false);
	const [picked, setPicked] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState("");
	const [error, setError] = useState<string | null>(null);
	const group = useId();

	const latest = diagnosis.latest;
	useEffect(() => {
		if (!latest) return;
		let live = true;
		Promise.all([crosswalks(), bulkLookups(), boundaryReleases()])
			.then(([all, lookups, releases]) => {
				if (live)
					setChoices(parentChoices(latest, all, lookups, releases));
			})
			.catch(() => {
				if (live) setChoicesFailed(true);
			});
		return () => {
			live = false;
		};
	}, [latest]);

	const counts = changeCounts(rowUpdates(diagnosis));
	const stuck =
		counts["no-successor"] + counts["not-checked"] + counts["not-matched"];
	const summary: { tone: Tone; text: string }[] = [
		counts.current > 0 && {
			tone: "ok" as const,
			text: `${rows(counts.current)} already in ${diagnosis.latestLabel}`,
		},
		counts.updated > 0 && {
			tone: "ok" as const,
			text: `${rows(counts.updated)} move to ${counts.updated === 1 ? "its" : "their"} successor`,
		},
		counts.split > 0 && {
			tone: "warn" as const,
			text: `${rows(counts.split)} split into several areas`,
		},
		stuck > 0 && {
			tone: "error" as const,
			text: `${rows(stuck)} can't be moved, and keep${stuck === 1 ? "s" : ""} ${stuck === 1 ? "its" : "their"} ${isCode ? "code" : "name"}`,
		},
	].filter((line) => !!line);

	async function download() {
		setBusy(true);
		setError(null);
		const parents = choices.filter((choice) => picked.includes(choice.id));
		try {
			if (parents.length > 0)
				setStatus(
					`Reading ${parents.map((p) => p.label).join(" and ")}…`,
				);
			const lookups = await Promise.all(parents.map(loadParents));
			const csv = updatedCsv(table, diagnosis, area, {
				codes,
				splits,
				name,
				parents: parents.map((choice, i) => ({
					header: choice.header,
					lookup: lookups[i],
				})),
			});
			downloadText(csv, derivedName(sourceName, "updated"));
			setStatus("Your updated file is downloading.");
		} catch (caught) {
			setStatus("");
			setError((caught as Error).message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card className="p-4 sm:p-5">
			<p className="text-[15px] text-slate-700">
				Moves each area to{" "}
				<strong className="font-semibold text-slate-900">
					{diagnosis.latestLabel}
				</strong>
				, the latest release.
			</p>
			<ul className="mt-3 space-y-1.5">
				{summary.map((line) => (
					<li
						key={line.text}
						className="flex gap-2.5 text-[14px] text-slate-800"
					>
						<ToneIcon tone={line.tone} />
						{line.text}
					</li>
				))}
			</ul>

			<div className="mt-5 grid gap-5 sm:grid-cols-2">
				<fieldset className="space-y-2">
					<legend className={labelClass}>
						{isCode ? "Codes" : "Area codes"}
					</legend>
					{isCode ? (
						<>
							<Choice
								name={`${group}-codes`}
								value="add"
								checked={codes === "add"}
								onChange={(v) => setCodes(v as CodeMode)}
							>
								Add a column with the latest code
							</Choice>
							<Choice
								name={`${group}-codes`}
								value="replace"
								checked={codes === "replace"}
								onChange={(v) => setCodes(v as CodeMode)}
							>
								Replace the old codes
							</Choice>
							<Choice
								name={`${group}-codes`}
								value="keep"
								checked={codes === "keep"}
								onChange={(v) => setCodes(v as CodeMode)}
							>
								Leave the codes as they are
							</Choice>
						</>
					) : (
						<>
							<Choice
								name={`${group}-codes`}
								value="add"
								checked={codes !== "keep"}
								onChange={() => setCodes("add")}
							>
								Add a column with each area&apos;s code
							</Choice>
							<Choice
								name={`${group}-codes`}
								value="keep"
								checked={codes === "keep"}
								onChange={() => setCodes("keep")}
							>
								No code column
							</Choice>
						</>
					)}
				</fieldset>

				{counts.split > 0 && (
					<fieldset className="space-y-2">
						<legend className={labelClass}>Split areas</legend>
						<Choice
							name={`${group}-splits`}
							value="list"
							checked={splits === "list"}
							onChange={(v) => setSplits(v as SplitMode)}
							hint={
								codes === "replace"
									? "The old code stays, since there is no one code to write."
									: undefined
							}
						>
							Keep one row, listing the new areas
						</Choice>
						<Choice
							name={`${group}-splits`}
							value="rows"
							checked={splits === "rows"}
							onChange={(v) => setSplits(v as SplitMode)}
							hint="Each copy keeps the row's values, so totals count them more than once."
						>
							One row for each new area
						</Choice>
					</fieldset>
				)}
			</div>

			<fieldset className="mt-5 space-y-2">
				<legend className={labelClass}>Add columns</legend>
				<Check checked={name} onChange={setName}>
					Area name
				</Check>
				{choices.map((choice) => (
					<Check
						key={choice.id}
						checked={picked.includes(choice.id)}
						onChange={(on) =>
							setPicked((current) =>
								on
									? [...current, choice.id]
									: current.filter((id) => id !== choice.id),
							)
						}
						hint={
							choice.method === "best-fit"
								? "Best fit: each area goes to the one it mostly falls in."
								: undefined
						}
					>
						{choice.label}
					</Check>
				))}
				{choicesFailed && (
					<p className="text-[13px] text-slate-500">
						Larger areas couldn&apos;t be loaded, so only the name
						can be added.
					</p>
				)}
			</fieldset>

			<p className="mt-4 text-[13px] text-slate-500">
				A column named{" "}
				<code className="font-mono text-[12px]">area_update</code> says
				what happened to each row.
			</p>

			<div className="mt-4 flex flex-wrap items-center gap-3">
				<Button variant="primary" onClick={download} disabled={busy}>
					<Download aria-hidden="true" className="h-4 w-4" />
					Download updated file
				</Button>
				<span role="status" className="text-[13px] text-slate-600">
					{status}
				</span>
			</div>
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
