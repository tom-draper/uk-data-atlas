import type { MeasureValuesPayload } from "./types";

/**
 * How a measure is drawn, decided by its value kind and unit rather than by a
 * per-dataset recipe: the colour classes of a map, the way a number reads, and
 * which chart suits the kind of value. Pure, so each rule can be tested alone.
 */

type ValueKind = MeasureValuesPayload["measure"]["valueKind"];

/** Five sequential classes, light to dark, readable on a light basemap. */
export const SEQUENTIAL_COLORS = [
	"#eff3ff",
	"#bdd7e7",
	"#6baed6",
	"#3182bd",
	"#08519c",
] as const;

export const NO_DATA_COLOR = "#d9d9d9";

export type MeasureScale = {
	/** Lower bound of each class after the first; one fewer than `colors`. */
	breaks: number[];
	colors: string[];
	min: number;
	max: number;
	/** The class index (0 based) a value falls in. */
	classOf(value: number): number;
	/** The colour of a value, or the no-data colour for null. */
	colorFor(value: number | null | undefined): string;
};

const quantile = (sorted: number[], fraction: number) => {
	const position = (sorted.length - 1) * fraction;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	return (
		sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower)
	);
};

/**
 * Colour classes for a set of values. Counts, quantities, currency and
 * ratios are skewed (a few large areas, many small), so their classes hold
 * equal numbers of areas; a rank or decile is already evenly spread, so its
 * classes are equal steps. Null if there is nothing to colour.
 */
export function buildScale(
	valueKind: ValueKind,
	values: readonly number[],
	colors: readonly string[] = SEQUENTIAL_COLORS,
): MeasureScale | null {
	const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
	if (sorted.length === 0) return null;
	const min = sorted[0]!;
	const max = sorted[sorted.length - 1]!;
	const classes = colors.length;
	const raw = Array.from({ length: classes - 1 }, (_, index) => {
		const fraction = (index + 1) / classes;
		return valueKind === "ordinal"
			? min + (max - min) * fraction
			: quantile(sorted, fraction);
	});
	// Equal breaks would make an empty class; keep each class distinct.
	const breaks = raw.filter(
		(value, index) => index === 0 || value > raw[index - 1]!,
	);
	const used = colors.slice(0, breaks.length + 1);
	const classOf = (value: number) => {
		let index = 0;
		while (index < breaks.length && value >= breaks[index]!) index += 1;
		return index;
	};
	return {
		breaks,
		colors: [...used],
		min,
		max,
		classOf,
		colorFor: (value) =>
			value === null || value === undefined || !Number.isFinite(value)
				? NO_DATA_COLOR
				: used[classOf(value)]!,
	};
}

const PERCENT = /%|percent/i;
const CURRENCY = /gbp|£|pound/i;

const number = (value: number, digits: number) =>
	value.toLocaleString("en-GB", {
		minimumFractionDigits: 0,
		maximumFractionDigits: digits,
	});

/** A value as a person reads it, by its kind and unit. */
export function formatMeasureValue(
	valueKind: ValueKind,
	unit: string,
	value: number | null | undefined,
): string {
	if (value === null || value === undefined || !Number.isFinite(value))
		return "No data";
	if (PERCENT.test(unit)) return `${number(value, 1)}%`;
	if (valueKind === "currency" || CURRENCY.test(unit))
		return `£${number(value, Math.abs(value) < 100 ? 2 : 0)}`;
	if (valueKind === "count" || valueKind === "ordinal")
		return number(value, 0);
	return number(value, Math.abs(value) < 100 ? 1 : 0);
}

/** The unit as a legend title says it, such as "people" or "% of premises". */
export const unitLabel = (unit: string) => unit.trim();

/** The bounds of each class as text, for a legend. */
export function legendEntries(
	scale: MeasureScale,
	format: (value: number) => string,
): Array<{ color: string; label: string }> {
	const bounds = [scale.min, ...scale.breaks, scale.max];
	return scale.colors.map((color, index) => ({
		color,
		label: `${format(bounds[index]!)} to ${format(bounds[index + 1]!)}`,
	}));
}

export type ChartKind = "ranked-bars" | "histogram" | "categories";

/**
 * Which chart suits a kind of value: ranked bars for amounts, where which
 * areas are largest matters; a histogram for a rank or decile, where only the
 * spread does; counts of each label for a category.
 */
export const chartKindFor = (valueKind: ValueKind): ChartKind =>
	valueKind === "ordinal"
		? "histogram"
		: valueKind === "categorical"
			? "categories"
			: "ranked-bars";

/** The `count` areas with the highest values, highest first. */
export function topAreas(
	rows: ReadonlyArray<{ code: string; value: number | null }>,
	count: number,
): Array<{ code: string; value: number }> {
	return rows
		.flatMap((row) =>
			row.value === null ? [] : [{ code: row.code, value: row.value }],
		)
		.sort((a, b) => b.value - a.value || a.code.localeCompare(b.code))
		.slice(0, count);
}

/** Values grouped into equal-width bins from the lowest to the highest. */
export function histogram(
	values: readonly number[],
	bins: number,
): Array<{ from: number; to: number; count: number }> {
	const finite = values.filter(Number.isFinite);
	if (finite.length === 0 || bins < 1) return [];
	const min = Math.min(...finite);
	const max = Math.max(...finite);
	const width = (max - min) / bins || 1;
	const result = Array.from({ length: bins }, (_, index) => ({
		from: min + width * index,
		to: min + width * (index + 1),
		count: 0,
	}));
	for (const value of finite) {
		const index = Math.min(bins - 1, Math.floor((value - min) / width));
		result[index]!.count += 1;
	}
	return result;
}

/** How many areas carry each category, most common first. */
export function categoryCounts(
	categories: ReadonlyArray<string | null>,
): Array<{ category: string; count: number }> {
	const counts = new Map<string, number>();
	for (const category of categories)
		if (category !== null)
			counts.set(category, (counts.get(category) ?? 0) + 1);
	return [...counts]
		.map(([category, count]) => ({ category, count }))
		.sort(
			(a, b) => b.count - a.count || a.category.localeCompare(b.category),
		);
}
