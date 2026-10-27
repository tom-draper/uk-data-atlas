/**
 * Searching the sorted arrays compiled indexes are laid out in.
 *
 * Compiled indexes sort by UTF-16 code unit rather than by locale. That order
 * does not depend on the ICU build a server happens to run, so the order the
 * compiler wrote is the order a request searches, and strings sharing a prefix
 * are always contiguous.
 */

/** A sorted array, or a table read as one. Arrays satisfy this already. */
export type Indexed<T> = {
	readonly length: number;
	at(index: number): T | undefined;
	/** Several items at once, where reading them together is cheaper. */
	atEach?(indexes: readonly number[]): Array<T | undefined>;
};

/** The items at several positions, read together where that is cheaper. */
export const atEach = <T>(sorted: Indexed<T>, indexes: readonly number[]) =>
	sorted.atEach
		? sorted.atEach(indexes)
		: indexes.map((index) => sorted.at(index));

import { compareCodeUnits } from "./compareCodeUnits";
export { compareCodeUnits } from "./compareCodeUnits";

/** The first position whose key is at or after `value`. */
export const lowerBound = <T>(
	sorted: Indexed<T>,
	value: string,
	key: (item: T) => string = (item) => item as unknown as string,
) => {
	let low = 0;
	let high = sorted.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (key(sorted.at(middle)!) < value) low = middle + 1;
		else high = middle;
	}
	return low;
};

/** The position whose key is `value`, or -1. */
export const findSorted = <T>(
	sorted: Indexed<T>,
	value: string,
	key: (item: T) => string = (item) => item as unknown as string,
) => {
	const position = lowerBound(sorted, value, key);
	return position < sorted.length && key(sorted.at(position)!) === value
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
