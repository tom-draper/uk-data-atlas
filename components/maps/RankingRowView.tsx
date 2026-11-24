import Link from "next/link";
import type { RankingRow } from "@/lib/atlas/rankingRows";

export const rankingLinkClass =
	"underline decoration-slate-300 underline-offset-[3px] hover:decoration-slate-700";

/** One area's row in a ranking table, on the server or once loaded. */
export function RankingRowView({ row }: { row: RankingRow }) {
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
			<td className="px-4 py-2 text-right whitespace-nowrap tabular-nums">
				{row.value}
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
