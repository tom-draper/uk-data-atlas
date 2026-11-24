"use client";

import { memo, useEffect, useState } from "react";
import { RankingRowView } from "@/components/maps/RankingRowView";
import type { RankingRow } from "@/lib/atlas/rankingRows";

/**
 * Rows added per frame. Thousands of rows at once would hold the page still;
 * added a frame at a time, every row is still in the page for find-in-page.
 */
const PER_FRAME = 500;

type State =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "failed" }
	| { status: "loaded"; chunks: RankingRow[][] };

/** One frame's rows; added once, then left alone as later ones arrive. */
const Chunk = memo(function Chunk({ rows }: { rows: RankingRow[] }) {
	return (
		<tbody className="divide-y divide-slate-900/[0.05] border-t border-slate-900/[0.05]">
			{rows.map((row) => (
				<RankingRowView key={row.code} row={row} />
			))}
		</tbody>
	);
});

/**
 * The rest of a long ranking, fetched when the reader asks for it. Every
 * area stays listed, without the page sending thousands of rows up front.
 */
export default function RankingRest({
	url,
	remaining,
	noun,
	columns,
}: {
	url: string;
	remaining: number;
	noun: string;
	columns: number;
}) {
	const [state, setState] = useState<State>({ status: "idle" });

	const total = state.status === "loaded" ? state.chunks.length : 0;
	const [shown, setShown] = useState(0);
	useEffect(() => {
		if (shown >= total) return;
		const frame = requestAnimationFrame(() => setShown(shown + 1));
		return () => cancelAnimationFrame(frame);
	}, [shown, total]);

	if (state.status === "loaded")
		return state.chunks
			.slice(0, shown)
			.map((rows) => <Chunk key={rows[0]!.code} rows={rows} />);

	const load = async () => {
		setState({ status: "loading" });
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(String(response.status));
			const rows = (await response.json()) as RankingRow[];
			const chunks: RankingRow[][] = [];
			for (let start = 0; start < rows.length; start += PER_FRAME)
				chunks.push(rows.slice(start, start + PER_FRAME));
			setState({ status: "loaded", chunks });
		} catch {
			setState({ status: "failed" });
		}
	};

	return (
		<tfoot>
			<tr className="border-t border-slate-900/[0.07]">
				<td colSpan={columns} className="px-4 py-4 text-center">
					<button
						type="button"
						onClick={load}
						disabled={state.status === "loading"}
						className="rounded-md border border-slate-300 bg-white px-4 py-2 text-[14px] font-medium text-slate-800 transition-colors hover:border-slate-400 disabled:opacity-60"
					>
						{state.status === "loading"
							? "Loading…"
							: `Show the other ${remaining.toLocaleString("en-GB")} ${noun}`}
					</button>
					{state.status === "failed" && (
						<p className="mt-2 text-[13px] text-slate-500">
							They could not be loaded. Try again.
						</p>
					)}
				</td>
			</tr>
		</tfoot>
	);
}
