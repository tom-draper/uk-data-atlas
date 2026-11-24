"use client";

import { memo, useDeferredValue, useEffect, useMemo, useState } from "react";
import { RankingRowView } from "@/components/maps/RankingRowView";
import type { RankingRow } from "@/lib/atlas/rankingRows";

/**
 * Rows added per frame. Thousands of rows at once would hold the page still;
 * added a frame at a time, every row is still in the page for find-in-page.
 */
const PER_FRAME = 500;

/** The column a table is sorted by: the rank, else a value column's index. */
type Sort = { column: "rank" | number; descending: boolean };

const BY_RANK: Sort = { column: "rank", descending: false };

type Load = "idle" | "loading" | "failed" | "loaded";

const compareKeys = (left: number | string, right: number | string) =>
	typeof left === "number" && typeof right === "number"
		? left - right
		: String(left).localeCompare(String(right), "en-GB");

export function sortedRows(rows: readonly RankingRow[], sort: Sort) {
	if (sort.column === "rank")
		return sort.descending ? [...rows].reverse() : rows;
	const column = sort.column;
	const sign = sort.descending ? -1 : 1;
	return [...rows].sort((left, right) => {
		const [a, b] = [left.keys[column] ?? null, right.keys[column] ?? null];
		// Missing values sort last whichever way the column is sorted.
		if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
		return sign * compareKeys(a, b) || left.rank - right.rank;
	});
}

export function matchingRows(rows: readonly RankingRow[], query: string) {
	const words = query.toLocaleLowerCase("en-GB").split(/\s+/).filter(Boolean);
	if (words.length === 0) return rows;
	return rows.filter((row) => {
		const text = `${row.name} ${row.note ?? ""}`.toLocaleLowerCase("en-GB");
		return words.every((word) => text.includes(word));
	});
}

/** One frame's rows; added once, then left alone as later ones arrive. */
const Chunk = memo(function Chunk({
	rows,
	scale,
}: {
	rows: readonly RankingRow[];
	scale: number | null;
}) {
	return (
		<tbody className="divide-y divide-slate-900/[0.05] border-t border-slate-900/[0.05]">
			{rows.map((row) => (
				<RankingRowView key={row.code} row={row} scale={scale} />
			))}
		</tbody>
	);
});

function SortHeader({
	label,
	column,
	sort,
	onSort,
	className,
}: {
	label: string;
	column: Sort["column"];
	sort: Sort;
	onSort: (sort: Sort) => void;
	className: string;
}) {
	const active = sort.column === column;
	// A value column reads highest first; the rank, first first.
	const first = column !== "rank";
	return (
		<th
			className={className}
			aria-sort={
				active ? (sort.descending ? "descending" : "ascending") : "none"
			}
		>
			<button
				type="button"
				onClick={() =>
					onSort({
						column,
						descending: active ? !sort.descending : first,
					})
				}
				className="inline-flex items-baseline gap-1 text-inherit hover:text-slate-900"
			>
				{label}
				<span
					aria-hidden
					className={active ? "text-slate-700" : "text-slate-300"}
				>
					{active ? (sort.descending ? "↓" : "↑") : "↕"}
				</span>
			</button>
		</th>
	);
}

/**
 * A ranking's table: its rows, searchable and sortable by any column. A long
 * ranking arrives with its first rows; the rest load when the reader asks for
 * them, or searches or sorts.
 */
export default function RankingTable({
	initial,
	total,
	url,
	noun,
	nameLabel,
	valueLabel,
	columns,
	scale,
}: {
	initial: RankingRow[];
	total: number;
	/** Where the rows after `initial` load from, when there are any. */
	url: string | null;
	noun: string;
	nameLabel: string;
	valueLabel: string;
	columns: string[];
	scale: number | null;
}) {
	const [rows, setRows] = useState<readonly RankingRow[]>(initial);
	const [load, setLoad] = useState<Load>(url ? "idle" : "loaded");
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<Sort>(BY_RANK);
	const deferredQuery = useDeferredValue(query);

	const loadRest = async () => {
		if (!url || load === "loading" || load === "loaded") return;
		setLoad("loading");
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(String(response.status));
			const rest = (await response.json()) as RankingRow[];
			setRows((current) => [...current, ...rest]);
			setLoad("loaded");
		} catch {
			setLoad("failed");
		}
	};

	const view = useMemo(
		() => sortedRows(matchingRows(rows, deferredQuery), sort),
		[rows, deferredQuery, sort],
	);
	const chunks = useMemo(() => {
		const split: (readonly RankingRow[])[] = [];
		for (let start = 0; start < view.length; start += PER_FRAME)
			split.push(view.slice(start, start + PER_FRAME));
		return split;
	}, [view]);

	// A new view starts from its first chunk and adds one a frame.
	const [shown, setShown] = useState({ chunks, count: 1 });
	if (shown.chunks !== chunks) setShown({ chunks, count: 1 });
	useEffect(() => {
		if (shown.count >= chunks.length) return;
		const frame = requestAnimationFrame(() =>
			setShown({ chunks, count: shown.count + 1 }),
		);
		return () => cancelAnimationFrame(frame);
	}, [shown, chunks]);

	// Sorting or searching a long ranking needs all of it.
	const browsing = query.trim() !== "" || sort !== BY_RANK;
	const partial = load !== "loaded";
	const span = 3 + columns.length;

	const onSort = (next: Sort) => {
		setSort(next.column === "rank" && !next.descending ? BY_RANK : next);
		void loadRest();
	};

	return (
		<>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-900/[0.07] px-4 py-3">
				<label className="relative min-w-0 flex-1 sm:max-w-[320px]">
					<span className="sr-only">Find {noun}</span>
					<input
						type="search"
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
							void loadRest();
						}}
						placeholder={`Find a ${nameLabel.toLowerCase()}`}
						className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
					/>
				</label>
				<p className="text-[13px] text-slate-500" aria-live="polite">
					{load === "loading"
						? `Loading all ${total.toLocaleString("en-GB")} ${noun}…`
						: load === "failed"
							? "The rest could not be loaded. Try again."
							: deferredQuery.trim()
								? `${view.length.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")} ${noun}`
								: null}
				</p>
			</div>
			<table className="w-full table-fixed text-left text-[14px]">
				{/* Widths sit on the columns: the extra ones are hidden on a
				    phone and must take no width there. */}
				<colgroup>
					<col className="w-14 sm:w-20" />
					<col />
					<col className="w-36" />
					{columns.map((column) => (
						<col key={column} className="w-0 sm:w-32" />
					))}
				</colgroup>
				<thead className="sticky top-0 z-10 bg-[#fbfbfa]/95 backdrop-blur-sm">
					<tr className="border-b border-slate-900/[0.07] text-[12px] font-semibold tracking-wide text-slate-500 shadow-[0_1px_0_rgba(15,23,42,0.07)]">
						<SortHeader
							label="Rank"
							column="rank"
							sort={sort}
							onSort={onSort}
							className="px-4 py-3"
						/>
						<th className="px-4 py-3">{nameLabel}</th>
						<SortHeader
							label={valueLabel}
							column={0}
							sort={sort}
							onSort={onSort}
							className="px-4 py-3 text-right"
						/>
						{columns.map((column, index) => (
							<SortHeader
								key={column}
								label={column}
								column={index + 1}
								sort={sort}
								onSort={onSort}
								className="hidden px-4 py-3 text-right font-medium sm:table-cell"
							/>
						))}
					</tr>
				</thead>
				{chunks.slice(0, shown.count).map((rows, index) => (
					<Chunk key={index} rows={rows} scale={scale} />
				))}
				{(view.length === 0 || (partial && !browsing)) && (
					<tfoot>
						<tr className="border-t border-slate-900/[0.07]">
							<td
								colSpan={span}
								className="px-4 py-4 text-center"
							>
								{view.length === 0 &&
								!(partial && load === "loading") ? (
									<p className="text-[14px] text-slate-500">
										No {noun} match “{deferredQuery.trim()}
										”.
									</p>
								) : (
									<button
										type="button"
										onClick={loadRest}
										disabled={load === "loading"}
										className="rounded-md border border-slate-300 bg-white px-4 py-2 text-[14px] font-medium text-slate-800 transition-colors hover:border-slate-400 disabled:opacity-60"
									>
										{load === "loading"
											? "Loading…"
											: `Show the other ${(total - rows.length).toLocaleString("en-GB")} ${noun}`}
									</button>
								)}
							</td>
						</tr>
					</tfoot>
				)}
			</table>
		</>
	);
}
