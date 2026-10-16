import type { Metadata } from "next";
import { siteMetadata, titleCase } from "@/lib/site";

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
