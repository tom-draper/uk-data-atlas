/** A finite decimal query value, or undefined when absent or invalid. */
export const readFiniteNumber = (value: string | null) => {
	if (value === null || value.trim() === "") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * A whole-number query value within an inclusive range. A missing value uses
 * the supplied fallback; malformed values remain distinguishable as invalid.
 */
export const readBoundedWholeNumber = (
	value: string | null,
	fallback: number,
	minimum: number,
	maximum: number,
) => {
	if (value === null) return fallback;
	const parsed = Number(value);
	return /^\d+$/.test(value) &&
		Number.isInteger(parsed) &&
		parsed >= minimum &&
		parsed <= maximum
		? parsed
		: undefined;
};
