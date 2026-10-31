"use client";

import { useId } from "react";
import { Card } from "@/components/docs/Page";
import { geographyLabel, releasesOf } from "@/lib/fix/releases";
import type { Table } from "@/lib/fix/table";
import type { BoundaryRelease, ReleaseRef } from "@/lib/fix/types";
import { labelClass, selectClass } from "./ui";

export interface ColumnChoice {
	area: number | null;
	parent: number | null;
	values: number[];
}

const PREVIEW_ROWS = 5;
const AUTO = "auto";

/**
 * What was detected, and the controls to change it: the area column, an
 * optional parent column for shared names, the number columns, and the
 * release to check against.
 */
export default function ColumnsPanel({
	table,
	choice,
	onChoice,
	release,
	onRelease,
	releases,
	detectedGeography,
	disabled,
}: {
	table: Table;
	choice: ColumnChoice;
	onChoice: (choice: ColumnChoice) => void;
	release: ReleaseRef | null;
	onRelease: (release: ReleaseRef | null) => void;
	releases: BoundaryRelease[];
	detectedGeography: string | null;
	disabled: boolean;
}) {
	const ids = { area: useId(), parent: useId(), release: useId() };
	const geographies = [...new Set(releases.map((r) => r.geography))].sort(
		(a, b) => {
			if (a === detectedGeography) return -1;
			if (b === detectedGeography) return 1;
			return geographyLabel(releases, a).localeCompare(
				geographyLabel(releases, b),
			);
		},
	);
	const columnOptions = table.headers.map((header, index) => (
		<option key={index} value={index}>
			{header}
		</option>
	));

	return (
		<Card className="p-4 sm:p-5">
			<div className="grid gap-4 sm:grid-cols-3">
				<div>
					<label htmlFor={ids.area} className={labelClass}>
						Area column
					</label>
					<select
						id={ids.area}
						className={selectClass}
						value={choice.area ?? ""}
						disabled={disabled}
						onChange={(event) => {
							const area = Number(event.target.value);
							onChoice({
								area,
								parent:
									choice.parent === area
										? null
										: choice.parent,
								values: choice.values.filter((v) => v !== area),
							});
						}}
					>
						{choice.area === null && (
							<option value="">Choose a column</option>
						)}
						{columnOptions}
					</select>
				</div>
				<div>
					<label htmlFor={ids.parent} className={labelClass}>
						Parent column{" "}
						<span className="font-normal text-slate-500">
							(optional, settles shared names)
						</span>
					</label>
					<select
						id={ids.parent}
						className={selectClass}
						value={choice.parent ?? ""}
						disabled={disabled}
						onChange={(event) =>
							onChoice({
								...choice,
								parent:
									event.target.value === ""
										? null
										: Number(event.target.value),
							})
						}
					>
						<option value="">None</option>
						{table.headers.map((header, index) =>
							index === choice.area ? null : (
								<option key={index} value={index}>
									{header}
								</option>
							),
						)}
					</select>
				</div>
				<div>
					<label htmlFor={ids.release} className={labelClass}>
						Boundary release
					</label>
					<select
						id={ids.release}
						className={selectClass}
						disabled={disabled || releases.length === 0}
						value={
							release
								? `${release.geography}/${release.boundaryRelease}`
								: AUTO
						}
						onChange={(event) => {
							const value = event.target.value;
							if (value === AUTO) return onRelease(null);
							const [geography, boundaryRelease] =
								value.split("/");
							onRelease({ geography, boundaryRelease });
						}}
					>
						<option value={AUTO}>Work it out for me</option>
						{geographies.map((geography) => (
							<optgroup
								key={geography}
								label={geographyLabel(releases, geography)}
							>
								{releasesOf(releases, geography).map(
									(entry) => (
										<option
											key={entry.id}
											value={`${geography}/${entry.id}`}
										>
											{entry.title}
										</option>
									),
								)}
							</optgroup>
						))}
					</select>
				</div>
			</div>

			{table.headers.length > 1 && (
				<fieldset className="mt-4">
					<legend className={labelClass}>Number columns</legend>
					<div className="flex flex-wrap gap-x-5 gap-y-2">
						{table.headers.map((header, index) =>
							index === choice.area ? null : (
								<label
									key={index}
									className="inline-flex items-center gap-2 text-[14px] text-slate-700"
								>
									<input
										type="checkbox"
										className="h-4 w-4 accent-slate-900"
										checked={choice.values.includes(index)}
										disabled={disabled}
										onChange={(event) =>
											onChoice({
												...choice,
												values: event.target.checked
													? [
															...choice.values,
															index,
														].sort((a, b) => a - b)
													: choice.values.filter(
															(v) => v !== index,
														),
											})
										}
									/>
									{header}
								</label>
							),
						)}
					</div>
				</fieldset>
			)}

			<div className="mt-5 overflow-x-auto rounded-md border border-slate-900/[0.07] bg-white/60">
				<table className="w-full text-left text-[13px]">
					<caption className="sr-only">
						The first {Math.min(PREVIEW_ROWS, table.rows.length)}{" "}
						rows of your file
					</caption>
					<thead>
						<tr className="border-b border-slate-900/[0.07]">
							{table.headers.map((header, index) => (
								<th
									key={index}
									scope="col"
									className={`px-3 py-2 font-medium whitespace-nowrap ${index === choice.area ? "bg-slate-100 text-slate-900" : "text-slate-600"}`}
								>
									{header}
									{index === choice.area && (
										<span className="ml-1.5 rounded bg-slate-900 px-1.5 py-0.5 text-[11px] font-medium text-white">
											area
										</span>
									)}
									{index === choice.parent && (
										<span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
											parent
										</span>
									)}
									{choice.values.includes(index) && (
										<span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
											number
										</span>
									)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{table.rows
							.slice(0, PREVIEW_ROWS)
							.map((row, rowIndex) => (
								<tr
									key={rowIndex}
									className="border-b border-slate-900/[0.05] last:border-0"
								>
									{row.map((cell, index) => (
										<td
											key={index}
											className={`px-3 py-1.5 font-mono whitespace-nowrap text-slate-700 ${index === choice.area ? "bg-slate-100/70" : ""}`}
										>
											{cell}
										</td>
									))}
								</tr>
							))}
					</tbody>
				</table>
			</div>
		</Card>
	);
}
