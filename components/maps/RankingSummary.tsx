import Link from "next/link";
import { Card } from "@/components/docs/Page";
import { rankingLinkClass } from "@/components/maps/RankingRowView";
import type { RankingRow } from "@/lib/atlas/rankingRows";

const SHOWN = 5;

/** Rankings shorter than this list every area close together already. */
const MIN_AREAS = 12;

function Extreme({ title, rows }: { title: string; rows: RankingRow[] }) {
	return (
		<Card className="p-5">
			<h2 className="text-[13px] font-semibold tracking-wide text-slate-500">
				{title}
			</h2>
			<ol className="mt-3 space-y-2">
				{rows.map((row) => (
					<li
						key={row.code}
						className="flex items-baseline gap-3 text-[15px]"
					>
						<span className="w-11 shrink-0 tabular-nums text-slate-400">
							{row.rank.toLocaleString("en-GB")}
						</span>
						<span className="min-w-0 flex-1 font-medium break-words text-slate-900">
							{row.href ? (
								<Link
									href={row.href}
									className={rankingLinkClass}
								>
									{row.name}
								</Link>
							) : (
								row.name
							)}
							{row.note && (
								<span className="block font-normal text-slate-500 sm:ml-2 sm:inline">
									{row.note}
								</span>
							)}
						</span>
						<span className="shrink-0 tabular-nums text-slate-900">
							{row.value}
						</span>
					</li>
				))}
			</ol>
		</Card>
	);
}

/**
 * The answer a ranking is visited for: the highest and lowest areas, and the
 * one in the middle, before the full table.
 */
export function RankingSummary({
	rows,
	one,
}: {
	/** Every row in rank order, or at least the first and last few and the middle one. */
	rows: { top: RankingRow[]; bottom: RankingRow[]; middle: RankingRow };
	one: string;
}) {
	return (
		<section className="mt-9 max-w-[900px]">
			<div className="grid gap-4 sm:grid-cols-2">
				<Extreme title="Highest" rows={rows.top} />
				<Extreme title="Lowest" rows={rows.bottom} />
			</div>
			<p className="mt-4 text-[15px] leading-[1.7] text-slate-600">
				The middle {one} is {rows.middle.name}
				{rows.middle.note ? ` (${rows.middle.note})` : ""}, at{" "}
				{rows.middle.value}.
			</p>
		</section>
	);
}

/** The positions a ranking's summary shows, or none for a short ranking. */
export function summaryPositions(count: number) {
	if (count < MIN_AREAS) return null;
	return {
		top: Array.from({ length: SHOWN }, (_, index) => index),
		bottom: Array.from({ length: SHOWN }, (_, index) => count - 1 - index),
		middle: Math.floor((count - 1) / 2),
	};
}
