/**
 * A name reduced to what distinguishes it: case, accents, punctuation and the
 * ampersand all set aside, so "Brighton & Hove", "brighton and hove" and
 * "Ynys Môn" match what was published.
 */
export const normalisePlaceName = (value: string) =>
	value
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

/**
 * The same name with an administrative title removed, or undefined when it
 * carries none. Publishers write "Bristol, City of" and "Kingston upon Hull,
 * City of"; nobody searches for either.
 */
export const withoutTitle = (normalised: string) => {
	const stripped = normalised
		.replace(/\b(city|county|borough|royal borough) of\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return stripped && stripped !== normalised ? stripped : undefined;
};

export type NameMatch = "exact" | "exact-without-title" | "prefix";

export const exactNameMatch = (
	label: string,
	query: string,
): Exclude<NameMatch, "prefix"> | undefined => {
	const normalised = normalisePlaceName(label);
	const requested = normalisePlaceName(query);
	if (normalised === requested) return "exact";
	return withoutTitle(normalised) === requested
		? "exact-without-title"
		: undefined;
};
