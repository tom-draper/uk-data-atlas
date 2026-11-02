import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/docs/Page";
import { linkClass, Section } from "@/components/places/PlaceUi";
import { PARTIES } from "@uk-data-atlas/datasets/data/election/parties";
import type { CouncilElection, WardElections } from "@/lib/places/elections";

const OTHER_COLOR = "#94a3b8";

const party = (key: string) => {
	const known = (PARTIES as Record<string, { name: string; color: string }>)[
		key
	];
	return {
		name: known?.name ?? (key === "OTHER" ? "Other" : key),
		color: known && key !== "OTHER" ? known.color : OTHER_COLOR,
	};
};

const percent = (value: number) => `${value.toFixed(1)}%`;

/** Parties as one bar, each segment its share of the whole. */
function StackedBar({
	parts,
	label,
}: {
	parts: [party: string, value: number][];
	label: string;
}) {
	const total = parts.reduce((sum, [, value]) => sum + value, 0);
	return (
		<div
			role="img"
			aria-label={label}
			className="flex h-3 overflow-hidden rounded-full bg-slate-100"
		>
			{parts.map(([key, value]) => (
				<span
					key={key}
					className="h-full border-r border-white last:border-r-0"
					style={{
						width: `${(value / total) * 100}%`,
						backgroundColor: party(key).color,
					}}
				/>
			))}
		</div>
	);
}

function PartyLegend({
	parts,
	format,
}: {
	parts: [party: string, value: number][];
	format: (value: number) => string;
}) {
	return (
		<ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px]">
			{parts.map(([key, value]) => (
				<li key={key} className="flex items-center gap-1.5">
					<span
						className="size-2.5 rounded-full"
						style={{ backgroundColor: party(key).color }}
					/>
					<span className="text-slate-700">{party(key).name}</span>
					<span className="font-medium text-slate-900 tabular-nums">
						{format(value)}
					</span>
				</li>
			))}
		</ul>
	);
}

function Chart({
	title,
	parts,
	format,
}: {
	title: string;
	parts: [party: string, value: number][];
	format: (value: number) => string;
}) {
	return (
		<div>
			<p className="mb-2 text-[13px] text-slate-500">{title}</p>
			<StackedBar
				parts={parts}
				label={parts
					.map(
						([key, value]) => `${party(key).name} ${format(value)}`,
					)
					.join(", ")}
			/>
			<PartyLegend parts={parts} format={format} />
		</div>
	);
}

function SourceNote({ children }: { children: ReactNode }) {
	return (
		<p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">
			{children} From the{" "}
			<Link href="/datasets#local-election" className={linkClass}>
				local election results
			</Link>
			.
		</p>
	);
}

/** "the Labour candidate", or a smaller party's where the source groups them. */
const candidate = (key: string) =>
	key === "OTHER"
		? "a candidate from a smaller party"
		: `the ${party(key).name} candidate`;

const yearSpan = (from: number, to: number) =>
	from === to ? String(from) : `${from} to ${to}`;

/** Earlier winners, a run of the same party's wins as one span of years. */
export function earlierWinners(earlier: WardElections["earlier"]) {
	const runs: { winner: string; from: number; to: number }[] = [];
	for (const [year, winner] of earlier) {
		const run = runs.at(-1);
		if (run?.winner === winner) run.from = year;
		else runs.push({ winner, from: year, to: year });
	}
	if (runs.length === 1) {
		const [run] = runs;
		return `${party(run!.winner).name} also won ${earlier.length === 1 ? "the earlier election" : `every earlier election`} in the data (${yearSpan(run!.from, run!.to)}).`;
	}
	return `Earlier winners: ${runs
		.map(
			(run) =>
				`${party(run.winner).name} (${yearSpan(run.from, run.to)})`,
		)
		.join(", ")}.`;
}

export function WardElectionsSection({
	name,
	elections,
}: {
	name: string;
	elections: WardElections;
}) {
	const { latest, earlier } = elections;
	const total = latest.votes.reduce((sum, [, votes]) => sum + votes, 0);
	return (
		<Section id="elections" title="Local elections">
			<p>
				{name}&apos;s {latest.year} local election was won by{" "}
				{candidate(latest.winner)}
				{latest.turnout !== undefined
					? `, on a turnout of ${percent(latest.turnout)}`
					: ""}
				.
			</p>
			<Card className="mt-4 p-4">
				<Chart
					title={`Votes in ${latest.year}`}
					parts={latest.votes}
					format={(votes) =>
						`${votes.toLocaleString("en-GB")} (${percent((votes / total) * 100)})`
					}
				/>
			</Card>
			{earlier.length > 0 && (
				<p className="mt-4">{earlierWinners(earlier)}</p>
			)}
			<SourceNote>
				Votes count each party&apos;s highest-polling candidate, so a
				ward electing several councillors shows one result rather than
				its seats.
			</SourceNote>
		</Section>
	);
}

const mostWards = (election: CouncilElection) => {
	const [top, second] = election.won;
	if (!top) return "No results";
	if (second && second[1] === top[1]) return "Tied for most wards";
	return `${party(top[0]).name} won ${top[1]} of ${election.wards}`;
};

export function CouncilElectionsSection({
	name,
	elections,
}: {
	name: string;
	elections: CouncilElection[];
}) {
	const [latest, ...earlier] = elections;
	if (!latest) return null;
	return (
		<Section id="elections" title="Local elections">
			<p>
				{name}&apos;s latest local elections in the data were in{" "}
				{latest.year}, with results for {latest.wards} wards.{" "}
				{mostWards(latest)}.
			</p>
			<Card className="mt-4 space-y-5 p-4">
				<Chart
					title={`Wards won in ${latest.year}`}
					parts={latest.won}
					format={String}
				/>
				<Chart
					title={`Share of the vote in ${latest.year}`}
					parts={latest.share}
					format={percent}
				/>
			</Card>
			{earlier.length > 0 && (
				<Card className="mt-4 divide-y divide-slate-900/[0.06]">
					{earlier.map((election) => (
						<div
							key={election.year}
							className="flex items-center gap-4 px-4 py-2.5 text-[14px]"
						>
							<span className="w-12 shrink-0 text-slate-500 tabular-nums">
								{election.year}
							</span>
							<span className="w-56 shrink-0 text-slate-800">
								{mostWards(election)}
							</span>
							<span className="min-w-0 flex-1">
								<StackedBar
									parts={election.won}
									label={election.won
										.map(
											([key, wards]) =>
												`${party(key).name} ${wards}`,
										)
										.join(", ")}
								/>
							</span>
						</div>
					))}
				</Card>
			)}
			<SourceNote>
				These are wards won, not seats: a ward electing several
				councillors counts once, and a council electing by thirds renews
				only some seats each year, so they do not show who controls the
				council.
			</SourceNote>
		</Section>
	);
}
