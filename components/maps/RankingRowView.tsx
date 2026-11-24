import Link from "next/link";
import type { RankingRow } from "@/lib/atlas/rankingRows";

export const rankingLinkClass =
	"underline decoration-slate-300 underline-offset-[3px] hover:decoration-slate-700";

/** One area's row in a ranking table, on the server or once loaded. */
export function RankingRowView({
	row,
	scale,
}: {
	row: RankingRow;
	/** The value a full bar stands for; no bar when null. */
	scale: number | null;
}) {
	const value = row.keys[0];
	return (
		<tr className="hover:bg-white/60">
			<td className="px-4 py-2 tabular-nums text-slate-500">
				{row.rank}
			</td>
			<td className="px-4 py-2 font-medium break-words text-slate-900">
				{row.href ? (
					<Link href={row.href} className={rankingLinkClass}>
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
			</td>
			<td className="relative px-4 py-2 text-right whitespace-nowrap tabular-nums">
				{row.value}
				{scale !== null && typeof value === "number" && (
					<span
						aria-hidden
						className="absolute inset-x-4 bottom-1 h-[3px] overflow-hidden rounded-full bg-slate-900/[0.05]"
					>
						<span
							className="block h-full rounded-full bg-slate-400"
							style={{ width: `${(value / scale) * 100}%` }}
						/>
					</span>
				)}
			</td>
			{row.extra.map((value, index) => (
				<td
					key={index}
					className="hidden px-4 py-2 text-right whitespace-nowrap tabular-nums text-slate-600 sm:table-cell"
				>
					{value}
				</td>
			))}
		</tr>
	);
}
