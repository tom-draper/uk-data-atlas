/**
 * The geometry of a value over time, drawn as a sparkline. Pure, so the one
 * card that draws a series for every measure can be tested without a browser.
 */

export type SeriesPoint = { period: string; value: number | null };

export type SparklineOptions = {
	/** Fixed value range; values outside it are held at its edge. */
	domain?: readonly [number, number];
	/**
	 * Without a `domain`, how far the range reaches past the lowest and
	 * highest value. A twentieth of the spread by default. The low end never
	 * goes below zero when every value is at least zero.
	 */
	margin?: number;
	/** Space left clear above and below the line, in a 100 by 100 box. */
	padY?: number;
};

export type Sparkline = {
	linePath: string;
	/** The line closed down to the base, for a soft fill. */
	areaPath: string;
	/** Where the latest value sits, for a marker. */
	last: { x: number; y: number };
};

/** The points that carry a number, in order. */
export const numericPoints = (
	points: readonly SeriesPoint[],
): Array<{ period: string; value: number }> =>
	points.filter(
		(point): point is { period: string; value: number } =>
			typeof point.value === "number" && Number.isFinite(point.value),
	);

/** The latest period with a value, or null if there is none. */
export const latestPoint = (points: readonly SeriesPoint[]) =>
	numericPoints(points).at(-1) ?? null;

const SIZE = 100;

/** A line over the values, or null when fewer than two make no line. */
export function sparkline(
	values: readonly number[],
	{ domain, margin, padY = 0 }: SparklineOptions = {},
): Sparkline | null {
	const finite = values.filter(Number.isFinite);
	if (finite.length < 2) return null;
	const lowest = Math.min(...finite);
	const highest = Math.max(...finite);
	const reach = margin ?? (highest - lowest) * 0.05;
	const [low, high] = domain ?? [
		lowest >= 0 ? Math.max(0, lowest - reach) : lowest - reach,
		highest + reach,
	];
	const span = high - low;
	const points = finite.map((value, index) => {
		const clamped = Math.min(Math.max(value, low), high);
		const fraction = span > 0 ? (clamped - low) / span : 0.5;
		return {
			x: (index / (finite.length - 1)) * SIZE,
			y: padY + (1 - fraction) * (SIZE - padY * 2),
		};
	});
	const linePath = `M ${points.map(({ x, y }) => `${x},${y}`).join(" L ")}`;
	return {
		linePath,
		areaPath: `${linePath} L ${SIZE},${SIZE} L 0,${SIZE} Z`,
		last: points.at(-1)!,
	};
}
