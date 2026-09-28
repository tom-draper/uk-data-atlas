/**
 * Searching the sorted arrays compiled indexes are laid out in.
 *
 * Compiled indexes sort by UTF-16 code unit rather than by locale. That order
 * does not depend on the ICU build a server happens to run, so the order the
 * compiler wrote is the order a request searches, and strings sharing a prefix
 * are always contiguous.
 */

export const compareCodeUnits = (left: string, right: string) =>
	left < right ? -1 : left > right ? 1 : 0;

/** The first position whose key is at or after `value`. */
export const lowerBound = <T>(
	sorted: readonly T[],
	value: string,
	key: (item: T) => string = (item) => item as unknown as string,
) => {
	let low = 0;
	let high = sorted.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (key(sorted[middle]!) < value) low = middle + 1;
		else high = middle;
	}
	return low;
};

/** The position whose key is `value`, or -1. */
export const findSorted = <T>(
	sorted: readonly T[],
	value: string,
	key: (item: T) => string = (item) => item as unknown as string,
) => {
	const position = lowerBound(sorted, value, key);
	return position < sorted.length && key(sorted[position]!) === value
		? position
		: -1;
};

/** The position of `value` in an ascending list of numbers, or -1. */
export const findNumber = (sorted: readonly number[], value: number) => {
	let low = 0;
	let high = sorted.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (sorted[middle]! < value) low = middle + 1;
		else high = middle;
	}
	return sorted[low] === value ? low : -1;
};
