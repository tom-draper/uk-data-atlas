/** A term as a slug: lower case, no accents, words joined by hyphens. */
export const measureSlug = (term: string) =>
	term
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
