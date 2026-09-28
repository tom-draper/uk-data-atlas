// One shared formatter. Number#toLocaleString sets up a new Intl formatter on
// every call (~20µs), which adds up when a hover re-renders every chart card
// and some cards format a number per bar.
const COUNT_FORMAT = new Intl.NumberFormat();

/** A number with locale digit grouping, as `value.toLocaleString()` gives. */
export function formatCount(value: number): string {
	return COUNT_FORMAT.format(value);
}

/** A count shortened to thousands or millions, such as `12k` or `1.4m`. */
export function formatCompactCount(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
	if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
	return formatCount(value);
}
