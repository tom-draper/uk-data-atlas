"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { FileUp } from "lucide-react";
import { Card } from "@/components/docs/Page";
import { ROW_LIMIT } from "@/lib/fix/table";
import { Button, labelClass } from "./ui";

export const SAMPLE_URL = "/fix/sample-wards.csv";
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Three ways in: drop or choose a file, paste a column, or try the sample.
 * The drop area is decoration over a real button and file input, so it works
 * from the keyboard and with screen readers.
 */
export default function InputPanel({
	onText,
	onError,
	busy,
}: {
	onText: (text: string, name: string) => void;
	onError: (message: string) => void;
	busy: boolean;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [pasted, setPasted] = useState("");
	const pasteId = useId();

	async function readFile(file: File | undefined) {
		if (!file) return;
		if (file.size > MAX_BYTES) {
			onError(
				`${file.name} is larger than 20 MB. Try a smaller file, or the first ${ROW_LIMIT.toLocaleString("en-GB")} rows.`,
			);
			return;
		}
		if (/\.(xlsx?|ods|numbers)$/i.test(file.name)) {
			onError(
				"That looks like a spreadsheet file. Save it as CSV first, or copy the columns and paste them below.",
			);
			return;
		}
		onText(await file.text(), file.name);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		setDragging(false);
		void readFile(event.dataTransfer.files[0]);
	}

	async function trySample() {
		try {
			const response = await fetch(SAMPLE_URL);
			if (!response.ok) throw new Error();
			onText(await response.text(), "sample-wards.csv");
		} catch {
			onError("The sample couldn't be loaded. Try again.");
		}
	}

	return (
		<Card className="p-4 sm:p-5">
			<div
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={onDrop}
				className={`flex flex-col items-center gap-3 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors ${dragging ? "border-slate-500 bg-slate-100" : "border-slate-900/15 bg-white/50"}`}
			>
				<FileUp aria-hidden="true" className="h-7 w-7 text-slate-400" />
				<p className="text-[15px] text-slate-700">
					Drop a CSV file here, or
				</p>
				<div className="flex flex-wrap justify-center gap-2">
					<Button
						variant="primary"
						onClick={() => input.current?.click()}
						disabled={busy}
					>
						Choose a file
					</Button>
					<Button onClick={trySample} disabled={busy}>
						Try a sample
					</Button>
				</div>
				<input
					ref={input}
					type="file"
					accept=".csv,.tsv,.txt,text/csv,text/plain"
					className="sr-only"
					tabIndex={-1}
					aria-hidden="true"
					onChange={(event) => {
						void readFile(event.target.files?.[0]);
						event.target.value = "";
					}}
				/>
				<p className="text-[13px] text-slate-500">
					Up to {ROW_LIMIT.toLocaleString("en-GB")} rows. Your file is
					read in your browser. Only the columns being checked are
					sent to our API, which doesn&apos;t store them.
				</p>
			</div>

			<details className="group mt-4">
				<summary className="cursor-pointer text-[14px] font-medium text-slate-700 hover:text-slate-900">
					Or paste a column
				</summary>
				<div className="mt-3">
					<label htmlFor={pasteId} className={labelClass}>
						Area codes or names, one per line. You can paste several
						columns from a spreadsheet.
					</label>
					<textarea
						id={pasteId}
						value={pasted}
						onChange={(event) => setPasted(event.target.value)}
						rows={6}
						spellCheck={false}
						placeholder={"ward_cd\nE05013408\nE05013471"}
						className="w-full rounded-md border border-slate-900/15 bg-white px-3 py-2 font-mono text-[13px] text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
					/>
					<Button
						className="mt-2"
						disabled={busy || !pasted.trim()}
						onClick={() => onText(pasted, "pasted.csv")}
					>
						Check pasted data
					</Button>
				</div>
			</details>
		</Card>
	);
}
