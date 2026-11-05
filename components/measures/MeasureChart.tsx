import { areaSeries, columnFor, measureRows } from "@/lib/measures/client";
import {
	categoryCounts,
	chartKindFor,
	formatMeasureValue,
	histogram,
	topAreas,
} from "@/lib/measures/presentation";
import type { MeasureValuesPayload } from "@/lib/measures/types";

const BAR = "#3182bd";
const MUTED = "#6b7280";

type Props = {
	payload: MeasureValuesPayload;
	period: string;
	/** Area names by code, where the boundary release supplies them. */
	names?: ReadonlyMap<string, string>;
	/** The area whose history is drawn beneath, when there are several periods. */
	selected?: string | null;
	/** Values of the selected area in every period, from a second request. */
	history?: MeasureValuesPayload | null;
};

/**
 * A minimal chart chosen by the measure's value kind: ranked bars for an
 * amount, a histogram for a rank or decile, counts for a category, and a line
 * of the selected area over time. It reads the response only; it knows no
 * dataset.
 */
export function MeasureChart({
	payload,
	period,
	names,
	selected,
	history,
}: Props) {
	const { valueKind, unit } = payload.measure;
	const format = (value: number | null) =>
		formatMeasureValue(valueKind, unit, value);
	const rows = measureRows(payload, period);
	const kind = chartKindFor(valueKind);
	const label = (code: string) => names?.get(code) ?? code;

	return (
		<div className="flex flex-col gap-4" data-chart={kind}>
			{kind === "ranked-bars" && (
				<RankedBars
					items={topAreas(rows, 10).map((row) => ({
						label: label(row.code),
						value: row.value,
						text: format(row.value),
					}))}
				/>
			)}
			{kind === "histogram" && (
				<Histogram
					bins={histogram(
						rows.flatMap((row) =>
							row.value === null ? [] : [row.value],
						),
						10,
					).map((bin) => ({
						label: `${format(bin.from)} to ${format(bin.to)}`,
						count: bin.count,
					}))}
				/>
			)}
			{kind === "categories" && (
				<RankedBars
					items={categoryCounts(
						rows.map((row) => row.category ?? null),
					).map((entry) => ({
						label: entry.category,
						value: entry.count,
						text: String(entry.count),
					}))}
				/>
			)}
			{selected && (history ?? payload).columns.length > 1 && (
				<Line
					title={label(selected)}
					points={areaSeries(history ?? payload, selected).map(
						(point) => ({
							x: point.period,
							y: point.value,
							text: format(point.value),
						}),
					)}
				/>
			)}
			{!columnFor(payload, period) && (
				<p className="text-sm text-gray-500">No data for {period}.</p>
			)}
		</div>
	);
}

function RankedBars({
	items,
}: {
	items: Array<{ label: string; value: number; text: string }>;
}) {
	const max = Math.max(...items.map((item) => item.value), 1);
	return (
		<ol className="flex flex-col gap-1 text-sm">
			{items.map((item) => (
				<li key={item.label} className="flex items-center gap-2">
					<span className="w-40 shrink-0 truncate">{item.label}</span>
					<svg
						className="h-3 grow"
						viewBox="0 0 100 3"
						preserveAspectRatio="none"
						aria-hidden
					>
						<rect
							width={(Math.max(item.value, 0) / max) * 100}
							height="3"
							fill={BAR}
						/>
					</svg>
					<span className="w-20 shrink-0 text-right tabular-nums">
						{item.text}
					</span>
				</li>
			))}
		</ol>
	);
}

function Histogram({
	bins,
}: {
	bins: Array<{ label: string; count: number }>;
}) {
	const max = Math.max(...bins.map((bin) => bin.count), 1);
	const width = 100 / Math.max(bins.length, 1);
	return (
		<svg viewBox="0 0 100 40" className="h-32 w-full" role="img">
			{bins.map((bin, index) => (
				<rect
					key={bin.label}
					x={index * width + 0.5}
					y={40 - (bin.count / max) * 40}
					width={width - 1}
					height={(bin.count / max) * 40}
					fill={BAR}
				>
					<title>{`${bin.label}: ${bin.count} areas`}</title>
				</rect>
			))}
		</svg>
	);
}

function Line({
	title,
	points,
}: {
	title: string;
	points: Array<{ x: string; y: number | null; text: string }>;
}) {
	const known = points.filter(
		(point): point is { x: string; y: number; text: string } =>
			point.y !== null,
	);
	if (known.length < 2) return null;
	const low = Math.min(...known.map((point) => point.y));
	const high = Math.max(...known.map((point) => point.y));
	const span = high - low || 1;
	const at = (index: number) => (index / (points.length - 1)) * 100;
	const path = points
		.flatMap((point, index) =>
			point.y === null
				? []
				: [`${at(index)},${36 - ((point.y - low) / span) * 32 + 2}`],
		)
		.join(" ");
	return (
		<figure>
			<figcaption className="mb-1 text-sm font-medium">
				{title}
			</figcaption>
			<svg viewBox="0 0 100 40" className="h-24 w-full" role="img">
				<polyline
					points={path}
					fill="none"
					stroke={BAR}
					strokeWidth="0.8"
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
			<div
				className="flex justify-between text-xs"
				style={{ color: MUTED }}
			>
				<span>
					{points[0]!.x}: {points[0]!.text}
				</span>
				<span>
					{points.at(-1)!.x}: {points.at(-1)!.text}
				</span>
			</div>
		</figure>
	);
}
