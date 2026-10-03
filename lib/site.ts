import type { Metadata } from "next";

export const SITE_NAME = "UK Data Atlas";

export const SITE_URL =
	process.env.NEXT_PUBLIC_SITE_URL || "https://ukdataatlas.com";

/** The site-wide share image, app/opengraph-image.tsx. */
const SITE_IMAGE = "/opengraph-image";

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
