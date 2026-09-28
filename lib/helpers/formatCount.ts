// One shared formatter. Number#toLocaleString sets up a new Intl formatter on
// every call (~20µs), which adds up when a hover re-renders every chart card
// and some cards format a number per bar.
const COUNT_FORMAT = new Intl.NumberFormat();

/** A number with locale digit grouping, as `value.toLocaleString()` gives. */
export function formatCount(value: number): string {
	return COUNT_FORMAT.format(value);
}
