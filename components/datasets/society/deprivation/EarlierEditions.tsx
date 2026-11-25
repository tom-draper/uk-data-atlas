"use client";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	EDITIONS_NOTE,
	earlierEditionCells,
	type EarlierEditionRow,
} from "@/lib/datasets/deprivationEditions";

/**
 * Earlier editions of an index as a plain list of snapshots, one per line.
 * Each line states that edition's own position and nothing relative to the
 * latest: no line, arrow or difference, since editions use different
 * indicators and data years and are not a trend.
 */
export function EarlierEditions({
	rows,
	areaNoun,
}: {
	rows: EarlierEditionRow[];
	areaNoun: string;
}) {
	const isDark = useIsDark();
	if (rows.length === 0) return null;
	const muted = isDark ? "text-gray-400" : "text-gray-500";
	return (
		<div
			className={`mt-2 pt-1.5 border-t text-[10px] leading-snug ${isDark ? "border-white/10" : "border-black/8"}`}
		>
			<div className={`font-medium ${muted}`}>Earlier editions</div>
			<table className="w-full">
				<tbody>
					{rows.map((row) => {
						const [year, position, detail] = earlierEditionCells(
							row,
							areaNoun,
						);
						return (
							<tr key={row.year}>
								<th
									scope="row"
									className="pr-2 text-left font-medium tabular-nums"
								>
									{year}
								</th>
								<td
									className="pr-2"
									colSpan={
										row.kind === "noMatch" ? 2 : undefined
									}
								>
									{position}
								</td>
								{row.kind !== "noMatch" && (
									<td
										className={`text-right tabular-nums ${muted}`}
									>
										{detail}
									</td>
								)}
							</tr>
						);
					})}
				</tbody>
			</table>
			<p className={`mt-1 text-[9px] ${muted}`}>{EDITIONS_NOTE}</p>
		</div>
	);
}
