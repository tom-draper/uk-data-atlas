import type { Metadata } from "next";

/** Title, description and canonical URL for a written docs page. */
export function docsMetadata(
	title: string,
	description: string,
	path: string,
): Metadata {
	const fullTitle = `${title} – UK Data Atlas API`;
	return {
		title: { absolute: fullTitle },
		description,
		alternates: { canonical: path },
		openGraph: { title: fullTitle, description },
	};
}
