import type { Metadata } from "next";
import { siteMetadata } from "@/lib/site";

const LOWERCASE_TITLE_WORDS = new Set([
	"a",
	"an",
	"and",
	"as",
	"at",
	"by",
	"for",
	"from",
	"in",
	"of",
	"on",
	"or",
	"the",
	"to",
	"via",
]);

/** Converts written page titles to the title case used in browser metadata. */
export function titleCase(value: string): string {
	const words = value.split(" ");

	return words
		.map((word, index) => {
			const lower = word.toLowerCase();
			const isEdgeWord = index === 0 || index === words.length - 1;

			if (!isEdgeWord && LOWERCASE_TITLE_WORDS.has(lower)) {
				return lower;
			}
			if (/^[A-Z0-9&]+$/.test(word)) return word;
			return word.charAt(0).toUpperCase() + word.slice(1);
		})
		.join(" ");
}

/** Title, description and canonical URL for a written docs page. */
export function docsMetadata(
	title: string,
	description: string,
	path: string,
): Metadata {
	return docsPageMetadata(
		`${titleCase(title)} - UK Data Atlas API`,
		description,
		path,
	);
}

/** The API docs' share card, app/docs/opengraph-image.tsx. */
const DOCS_IMAGE = "/docs/opengraph-image";

/** A docs page's metadata, under its full title, with the docs' share card. */
export function docsPageMetadata(
	title: string,
	description: string,
	path: string,
): Metadata {
	return siteMetadata({ title, description, path, image: DOCS_IMAGE });
}
