import { Card } from "@/components/docs/Page";
import type { Diagnosis, Finding } from "@/lib/fix/diagnose";
import { ToneIcon } from "./ui";

const SHOWN_ROWS = 50;

function FindingRows({ finding }: { finding: Finding }) {
	if (finding.rows.length === 0) return null;
	const shown = finding.rows.slice(0, SHOWN_ROWS);
	const hasNotes = shown.some((row) => row.note);
	return (
		<details className="mt-1.5">
			<summary className="cursor-pointer text-[13px] text-slate-500 hover:text-slate-800">
				Show{" "}
				{finding.rows.length === 1
					? "the row"
					: `${finding.rows.length.toLocaleString("en-GB")} rows`}
			</summary>
			<div className="mt-2 overflow-x-auto">
				<table className="w-full text-left text-[13px]">
					<thead>
						<tr className="text-slate-500">
							<th scope="col" className="py-1 pr-4 font-medium">
								Row
							</th>
							<th scope="col" className="py-1 pr-4 font-medium">
								Value
							</th>
							{hasNotes && (
								<th scope="col" className="py-1 font-medium">
									Detail
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{shown.map((row) => (
							<tr
								key={row.line}
								className="border-t border-slate-900/[0.05] align-top"
							>
								<td className="py-1 pr-4 text-slate-500 tabular-nums">
									{row.line}
								</td>
								<td className="py-1 pr-4 font-mono whitespace-nowrap text-slate-800">
									{row.value || "(empty)"}
								</td>
								{hasNotes && (
									<td className="py-1 text-slate-600">
										{row.note}
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
				{finding.rows.length > SHOWN_ROWS && (
					<p className="mt-1 text-[12px] text-slate-500">
						The first {SHOWN_ROWS} rows. The match report lists them
						all.
					</p>
				)}
			</div>
		</details>
	);
}

/** The column's diagnosis: what it is, then each thing found, worst marked clearly. */
export default function DiagnosisPanel({
	diagnosis,
}: {
	diagnosis: Diagnosis;
}) {
	const share = diagnosis.total
		? `${diagnosis.matched.toLocaleString("en-GB")} of ${diagnosis.total.toLocaleString("en-GB")} matched`
		: "";
	return (
		<Card className="p-4 sm:p-5">
			<p className="text-[16px] leading-snug text-slate-900">
				<span className="font-mono text-[14px]">
					Column &ldquo;{diagnosis.column}&rdquo;
				</span>{" "}
				<span aria-hidden="true">→</span>
				<span className="sr-only">is</span>{" "}
				{diagnosis.releaseLabel ? (
					<>
						<strong className="font-semibold">
							{diagnosis.releaseLabel}
						</strong>{" "}
						<span className="text-slate-600">({share})</span>
					</>
				) : (
					<strong className="font-semibold">
						no boundary release we hold
					</strong>
				)}
			</p>
			{diagnosis.inferred && diagnosis.tiedWith.length > 0 && (
				<p className="mt-1 text-[13px] text-slate-500">
					{diagnosis.tiedWith.length === 1
						? `${diagnosis.tiedWith[0]} fits as well. `
						: `${diagnosis.tiedWith.length} other releases fit as well, back to ${diagnosis.tiedWith[diagnosis.tiedWith.length - 1]}. `}
					This is the newest of them. Choose another release above if
					you know which one your data uses.
				</p>
			)}
			<ul className="mt-4 space-y-3">
				{diagnosis.findings.map((finding) => (
					<li key={finding.id} className="flex gap-2.5">
						<ToneIcon tone={finding.tone} />
						<div className="min-w-0 flex-1">
							<p className="text-[15px] font-medium text-slate-900">
								{finding.title}
							</p>
							{finding.detail && (
								<p className="text-[14px] text-slate-600">
									{finding.detail}
								</p>
							)}
							<FindingRows finding={finding} />
						</div>
					</li>
				))}
			</ul>
		</Card>
	);
}
