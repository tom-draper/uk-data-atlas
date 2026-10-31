import type { Metadata } from "next";

export const SITE_NAME = "UK Data Atlas";

export const SITE_URL =
	process.env.NEXT_PUBLIC_SITE_URL || "https://ukdataatlas.com";

/**
 * Where the public API is served. The docs show it in their examples, and
 * browser tools such as /fix call it directly.
 */
export const API_ORIGIN = "https://api.ukdataatlas.com";
export const API_BASE_URL = `${API_ORIGIN}/v1`;

/** The site-wide share image, app/opengraph-image.tsx. */
const SITE_IMAGE = "/opengraph-image";

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
	const words = value.replace(/ & /g, " and ").split(" ");

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

/** "Population Density in London - UK Data Atlas". */
export function pageTitle(subject: string) {
	return `${subject} - ${SITE_NAME}`;
}

/**
 * A page's title, description, canonical URL and share tags. A page's own
 * openGraph replaces the layout's whole, and with it the site's share image,
 * so every field is set here. A page whose segment has an opengraph-image
 * file passes `image: null`, since an image set here would replace it.
 */
export function siteMetadata({
	title,
	description,
	path,
	image = SITE_IMAGE,
	robots,
}: {
	title: string;
	description: string;
	path: string;
	image?: string | null;
	robots?: Metadata["robots"];
}): Metadata {
	return {
		title: { absolute: title },
		description,
		alternates: { canonical: path },
		openGraph: {
			title,
			description,
			url: path,
			siteName: SITE_NAME,
			locale: "en_GB",
			type: "website",
			...(image ? { images: [image] } : {}),
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			...(image ? { images: [image] } : {}),
		},
		...(robots ? { robots } : {}),
	};
}

/** Metadata for a page titled "{subject} - UK Data Atlas". */
export function pageMetadata({
	subject,
	...rest
}: Omit<Parameters<typeof siteMetadata>[0], "title"> & { subject: string }) {
	return siteMetadata({ title: pageTitle(subject), ...rest });
}
