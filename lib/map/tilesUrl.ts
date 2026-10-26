/** Preserve the manifest's content hash through PMTiles protocol registration. */
export const pmtilesURL = (href: string, base: string) =>
	`pmtiles://${new URL(href, base).href}`;
