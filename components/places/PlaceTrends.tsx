import Link from "next/link";
import { Card } from "@/components/docs/Page";
import CopyButton from "@/components/docs/CopyButton";
import { linkClass, Section } from "@/components/places/PlaceUi";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { JsonLd } from "@/lib/atlas/structuredData";
import {
	formatTrendValue,
	trendKind,
	type PlaceTrendEvent,
	type PlaceTrendKind,
	type PlaceTrendPoint,
	type PlaceTrendView,
} from "@/lib/places/trends";

/**
 * A place's series on its current boundary: the latest value, a chart of
 * every period, the boundary changes that made the area, where it ranks
 * among comparable councils and a citation. Converted values are drawn
 * apart from published ones and link to how accurate conversion is.
 */

const ACCURACY_URL =
	"https://github.com/tom-draper/uk-data-atlas/blob/main/docs/conversion-accuracy.md";

const KIND_NAMES: Record<PlaceTrendKind, string> = {
	published: "Published",
	regrouped: "Regrouped from earlier areas",
	estimated: "Estimated from areas it cuts across",
};

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/** A period's position in years, a yearly estimate sitting at mid-year. */
const periodAt = (period: string) => Number(period.slice(0, 4)) + 0.5;

const dateAt = (date: string) => {
	const [year, month = 1, day = 1] = date.split("-").map(Number);
	return year! + (month - 1 + (day - 1) / 31) / 12;
};

const longDate = (date: string) => {
	const [year, month = 1, day = 1] = date.split("-").map(Number);
	return `${day} ${MONTHS[month - 1]} ${year}`;
};

const listed = (names: string[]) =>
	names.length <= 1
		? (names[0] ?? "")
		: `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

const EVENT_VERBS: Record<string, string> = {
	merged: "Formed",
	split: "Formed",
	redistributed: "Boundary changed",
	redrawn: "Boundary redrawn",
};

/** A step of 1, 2 or 5 times a power of ten that cuts the range into about three. */
function niceStep(range: number) {
	const raw = range / 3;
	const power = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 5, 10].find((m) => m * power >= raw)!;
	return step * power;
}

const compact = (value: number) =>
	new Intl.NumberFormat("en-GB", {
		notation: "compact",
		maximumSignificantDigits: 3,
	}).format(value);

function TrendChart({ view, name }: { view: PlaceTrendView; name: string }) {
	const { points, events } = view.area;
	const values = points.flatMap((point) =>
		point[2] === 2 ? [point[1], point[3], point[4]] : [point[1]],
	);
	const low = Math.min(...values);
	const high = Math.max(...values);
	const step = niceStep(Math.max(high - low, high * 0.02));
	const y0 = Math.floor(low / step) * step;
	const y1 = Math.max(Math.ceil(high / step) * step, y0 + step);
	const x0 = periodAt(points[0]![0]);
	const x1 = Math.max(periodAt(points.at(-1)![0]), x0 + 1);
	const x = (at: number) => ((at - x0) / (x1 - x0)) * 100;
	const y = (value: number) => 100 - ((value - y0) / (y1 - y0)) * 100;
	const ticks: number[] = [];
	for (let tick = y0; tick <= y1 + step / 2; tick += step) ticks.push(tick);
	const shown = events.filter((event) => {
		const at = dateAt(event.date);
		return at > x0 && at < x1;
	});
	// A segment is drawn dashed where either end was converted.
	const segments = points.slice(1).map((point, index) => {
		const before = points[index]!;
		return {
			from: before,
			to: point,
			converted: before[2] !== 0 || point[2] !== 0,
		};
	});
	const band = points.filter(
		(point): point is [string, number, 2, number, number] => point[2] === 2,
	);
	const markAll = points.length <= 20;
	const labelYears = (() => {
		const first = Number(points[0]![0].slice(0, 4));
		const last = Number(points.at(-1)![0].slice(0, 4));
		const every = last - first > 24 ? 10 : 5;
		const years = [first];
		for (
			let year = Math.ceil((first + every / 2) / every) * every;
			year <= last - every / 2;
			year += every
		)
			years.push(year);
		if (last !== first) years.push(last);
		return years;
	})();

	return (
		<figure className="mt-4">
			<Card className="px-4 pt-8 pb-3 sm:px-5">
				<div
					className="relative ml-10 h-44 sm:h-52"
					role="img"
					aria-label={`${view.label} of ${name}, ${view.periodName(points[0]![0])} to ${view.periodName(points.at(-1)![0])}. The figures are in the table below.`}
				>
					<svg
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						className="absolute inset-0 h-full w-full overflow-visible"
						aria-hidden
					>
						{ticks.map((tick) => (
							<line
								key={tick}
								x1={0}
								x2={100}
								y1={y(tick)}
								y2={y(tick)}
								className="stroke-slate-900/[0.08]"
								strokeWidth={1}
								vectorEffect="non-scaling-stroke"
							/>
						))}
						{band.length > 1 && (
							<polygon
								className="fill-slate-400/20"
								points={[
									...band.map(
										(point) =>
											`${x(periodAt(point[0]))},${y(point[4])}`,
									),
									...band
										.toReversed()
										.map(
											(point) =>
												`${x(periodAt(point[0]))},${y(point[3])}`,
										),
								].join(" ")}
							/>
						)}
						{shown.map((event) => (
							<line
								key={event.date}
								x1={x(dateAt(event.date))}
								x2={x(dateAt(event.date))}
								y1={-6}
								y2={100}
								className="stroke-blue-600/60"
								strokeWidth={1}
								strokeDasharray="3 3"
								vectorEffect="non-scaling-stroke"
							/>
						))}
						{segments.map(({ from, to, converted }) => (
							<line
								key={to[0]}
								x1={x(periodAt(from[0]))}
								x2={x(periodAt(to[0]))}
								y1={y(from[1])}
								y2={y(to[1])}
								className="stroke-slate-800"
								strokeWidth={2}
								strokeLinecap="round"
								strokeDasharray={converted ? "4 4" : undefined}
								vectorEffect="non-scaling-stroke"
							/>
						))}
					</svg>
					{ticks.map((tick) => (
						<span
							key={tick}
							aria-hidden
							className="absolute right-full -translate-y-1/2 pr-2 text-[11px] text-slate-400 tabular-nums"
							style={{ top: `${y(tick)}%` }}
						>
							{compact(tick)}
						</span>
					))}
					{shown.map((event) => {
						const at = x(dateAt(event.date));
						return (
							<a
								key={event.date}
								href="#history"
								className={`absolute -top-7 text-[11.5px] font-medium whitespace-nowrap text-blue-700 hover:underline ${at > 70 ? "-translate-x-full pr-1" : "pl-1"}`}
								style={{ left: `${at}%` }}
							>
								{EVENT_VERBS[event.kind] ?? "Changed"}{" "}
								{event.date.slice(0, 4)}
							</a>
						);
					})}
					{points.map((point, index) => {
						const at = x(periodAt(point[0]));
						const kind = trendKind(point);
						const last = index === points.length - 1;
						const marked = markAll || last || kind !== "published";
						const width = 100 / Math.max(points.length - 1, 1);
						return (
							<div
								key={point[0]}
								className="group absolute inset-y-0 -translate-x-1/2"
								style={{
									left: `${at}%`,
									width: `${width}%`,
									minWidth: 8,
								}}
							>
								<span
									aria-hidden
									className="absolute inset-y-0 left-1/2 hidden w-px bg-slate-400/60 group-hover:block"
								/>
								<span
									aria-hidden
									className={`absolute left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${kind === "published" ? "bg-slate-800" : "border-2 border-slate-800 bg-white"} ${marked ? "" : "hidden group-hover:block"}`}
									style={{ top: `${y(point[1])}%` }}
								/>
								<span
									className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-slate-900 px-2 py-1 text-[11.5px] whitespace-nowrap text-white shadow group-hover:block ${at > 70 ? "right-1/2" : at < 30 ? "left-1/2" : "left-1/2 -translate-x-1/2"}`}
								>
									<span className="font-semibold tabular-nums">
										{formatTrendValue(point[1])}
									</span>{" "}
									{view.periodName(point[0])}
									{kind !== "published" && (
										<span className="block text-slate-300">
											{KIND_NAMES[kind]}
											{point[2] === 2 &&
												`, ${formatTrendValue(point[3])} to ${formatTrendValue(point[4])}`}
										</span>
									)}
								</span>
							</div>
						);
					})}
				</div>
				<div
					aria-hidden
					className="relative mt-1.5 ml-10 h-4 text-[11px] text-slate-400 tabular-nums"
				>
					{labelYears.map((year, index) => (
						<span
							key={year}
							className={`absolute ${index === 0 ? "" : index === labelYears.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
							style={{ left: `${x(year + 0.5)}%` }}
						>
							{year}
						</span>
					))}
				</div>
			</Card>
		</figure>
	);
}

/** "Formed on 1 April 2023 from Allerdale, Carlisle and Copeland." */
function eventSentence(event: PlaceTrendEvent, points: PlaceTrendPoint[]) {
	const at = dateAt(event.date);
	const before = points.filter((point) => periodAt(point[0]) < at);
	const verb = EVENT_VERBS[event.kind] ?? "Changed";
	const from = listed(event.from.map(([, name]) => name));
	const head =
		verb === "Formed"
			? `Formed on ${longDate(event.date)}${from ? ` from ${from}` : ""}.`
			: `${verb} on ${longDate(event.date)}${from ? `, taking in parts of ${from}` : ""}.`;
	if (before.length === 0) return head;
	const converted = before.filter((point) => point[2] !== 0).length;
	return `${head} ${
		converted === 0
			? "Earlier years are the publisher's own estimates for the same ground, so there is no break at the change."
			: converted === before.length
				? "Earlier years add up the areas it was made from, on today's boundary."
				: "Some earlier years add up the areas it was made from, on today's boundary."
	}`;
}

function Change({ view }: { view: PlaceTrendView }) {
	const first = view.area.points[0]!;
	if (first[0] === view.latest.period || first[1] === 0) return null;
	const change = (view.latest.value - first[1]) / first[1];
	const size = Math.abs(change * 100).toFixed(1);
	return (
		<span className="block text-[13px] text-slate-500">
			{size === "0.0"
				? `About the same as in ${view.periodName(first[0])}`
				: `${change > 0 ? "Up" : "Down"} ${size}% since ${view.periodName(first[0])}`}
		</span>
	);
}

function Standing({ view }: { view: PlaceTrendView }) {
	const standing = view.standing;
	if (!standing) return null;
	return (
		<div className="mt-6">
			<h3 className="text-[15px] font-semibold text-slate-900">
				Compared with other {standing.groupName}
			</h3>
			<p className="mt-1">
				{standing.phrase} of {standing.of.toLocaleString("en-GB")}{" "}
				{standing.groupName} in {view.periodName(standing.period)}, and
				the councils nearest it in size.
				{view.ranking && (
					<>
						{" "}
						See also{" "}
						<Link href={view.ranking.href} className={linkClass}>
							{view.ranking.label}
						</Link>
						.
					</>
				)}
			</p>
			<Card className="mt-3 divide-y divide-slate-900/[0.06] text-[14px]">
				{standing.peers.map((peer) => {
					return (
						<div
							key={peer.code}
							className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center px-4 py-2"
						>
							<span className="text-slate-400 tabular-nums">
								{peer.rank}
							</span>
							{peer.rank === standing.rank ? (
								<span className="truncate font-semibold text-slate-900">
									{standing.names[peer.code]}
								</span>
							) : (
								<Link
									href={`/places/${peer.code}`}
									className={`truncate ${linkClass}`}
								>
									{standing.names[peer.code]}
								</Link>
							)}
							<span
								className={`text-right tabular-nums ${peer.rank === standing.rank ? "font-semibold text-slate-900" : "text-slate-600"}`}
							>
								{formatTrendValue(peer.value)}
							</span>
						</div>
					);
				})}
			</Card>
		</div>
	);
}

/** The figure with its source, period and page, ready to paste. */
export const trendCitation = (
	view: PlaceTrendView,
	name: string,
	code: string,
) =>
	`${view.label} of ${name}, ${view.periodName(view.latest.period)}: ${formatTrendValue(view.latest.value)}. Source: ${view.source.publisher}, ${view.source.name} (${view.source.edition} release), ${view.source.licence}. Via ${SITE_NAME}, ${SITE_URL}/places/${code}`;

function Cite({
	view,
	name,
	code,
}: {
	view: PlaceTrendView;
	name: string;
	code: string;
}) {
	const citation = trendCitation(view, name, code);
	return (
		<div className="mt-6">
			<h3 className="text-[15px] font-semibold text-slate-900">
				Cite this figure
			</h3>
			<Card className="mt-2 flex items-start gap-2 py-2.5 pr-2 pl-4">
				<p className="min-w-0 flex-1 text-[13px] leading-relaxed text-slate-600 select-all">
					{citation}
				</p>
				<CopyButton
					value={citation}
					label="Copy citation"
					tone="light"
				/>
			</Card>
		</div>
	);
}

function TrendTable({ view }: { view: PlaceTrendView }) {
	return (
		<details className="mt-3 text-[13.5px]">
			<summary className="cursor-pointer text-slate-500 hover:text-slate-800">
				Every figure in the chart
			</summary>
			<Card className="mt-2 overflow-hidden">
				<table className="w-full text-left">
					<thead>
						<tr className="border-b border-slate-900/[0.07] text-[12px] font-semibold text-slate-500">
							<th className="px-4 py-2">Period</th>
							<th className="px-4 py-2 text-right">
								{view.label}
							</th>
							<th className="px-4 py-2">How it was made</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-900/[0.05]">
						{view.area.points.toReversed().map((point) => (
							<tr key={point[0]}>
								<td className="px-4 py-1.5 text-slate-500 tabular-nums">
									{view.periodName(point[0])}
								</td>
								<td className="px-4 py-1.5 text-right text-slate-900 tabular-nums">
									{formatTrendValue(point[1])}
								</td>
								<td className="px-4 py-1.5 text-slate-500">
									{KIND_NAMES[trendKind(point)]}
									{point[2] === 2 &&
										`, ${formatTrendValue(point[3])} to ${formatTrendValue(point[4])}`}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</Card>
		</details>
	);
}

/** Schema.org Dataset for the series, so search engines can read the figures' source. */
function trendJsonLd(view: PlaceTrendView, name: string, code: string) {
	const points = view.area.points;
	const first = points[0]![0];
	const last = view.latest.period;
	return {
		"@context": "https://schema.org",
		"@type": "Dataset",
		name: `${view.label} of ${name}, ${view.periodName(first)} to ${view.periodName(last)}`,
		description: `${view.label} of ${name} each year from ${view.periodName(first)} to ${view.periodName(last)}, on its current boundary: ${formatTrendValue(view.latest.value)} in ${view.periodName(last)}. From ${view.source.publisher}, ${view.source.name}.`,
		url: `${SITE_URL}/places/${code}#${view.key}`,
		creator: { "@type": "Organization", name: view.source.publisher },
		isBasedOn: view.source.url,
		license: view.source.licenceUrl,
		temporalCoverage: `${first.slice(0, 4)}/${last.slice(0, 4)}`,
		spatialCoverage: { "@type": "Place", name },
		variableMeasured: view.label,
	};
}

export function PlaceTrend({
	view,
	name,
	code,
	datasetHref,
}: {
	view: PlaceTrendView;
	name: string;
	code: string;
	datasetHref: string;
}) {
	const { points, events } = view.area;
	const converted = points.filter((point) => point[2] !== 0).length;
	return (
		<Section id={view.key} title={view.label}>
			<JsonLd data={trendJsonLd(view, name, code)} />
			<p className="flex flex-wrap items-baseline gap-x-3">
				<span className="text-[30px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">
					{formatTrendValue(view.latest.value)}
				</span>
				<span className="text-[14px] text-slate-500">
					{view.periodName(view.latest.period)} estimate,{" "}
					<Link href={datasetHref} className={linkClass}>
						{view.source.publisher}
					</Link>
				</span>
			</p>
			<Change view={view} />
			<TrendChart view={view} name={name} />
			<div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-slate-500">
				<span className="inline-flex items-center gap-1.5">
					<span className="size-2 rounded-full bg-slate-800" />
					Published
				</span>
				{converted > 0 && (
					<span className="inline-flex items-center gap-1.5">
						<span className="size-2 rounded-full border-2 border-slate-800 bg-white" />
						Converted to today&apos;s boundary,{" "}
						<a
							href={ACCURACY_URL}
							className={linkClass}
							target="_blank"
							rel="noopener noreferrer"
						>
							how accurate
						</a>
					</span>
				)}
			</div>
			<p className="mt-4">
				Every year is on {name}&apos;s current boundary
				{converted === 0
					? ", as the publisher estimates it."
					: converted === points.length
						? `. All ${points.length} years were converted from earlier boundaries.`
						: `. ${converted} of ${points.length} years were converted from earlier boundaries.`}
				{events.length > 0 && (
					<>
						{" "}
						{events
							.map((event) => eventSentence(event, points))
							.join(" ")}{" "}
						<a href="#history" className={linkClass}>
							Boundary history
						</a>
						.
					</>
				)}
			</p>
			<TrendTable view={view} />
			<Standing view={view} />
			<Cite view={view} name={name} code={code} />
		</Section>
	);
}
