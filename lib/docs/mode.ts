/**
 * Whether the API documentation is published, set per deployment by
 * `DOCS_MODE` so the docs can merge before the API is live.
 *
 * - `off` (the default): every docs route is a 404 and nothing links to them.
 * - `preview`: the docs are served but marked `noindex`, and left out of the
 *   sitemap and site navigation, for review on preview deployments.
 * - `public`: the docs are served, indexed and linked.
 *
 * An unrecognised value is treated as `off`, so a typo never publishes them.
 */
export type DocsMode = "off" | "preview" | "public";

export function parseDocsMode(value: string | undefined): DocsMode {
	const mode = value?.trim().toLowerCase();
	return mode === "preview" || mode === "public" ? mode : "off";
}

export function docsMode(): DocsMode {
	return parseDocsMode(process.env.DOCS_MODE);
}

export function docsEnabled(): boolean {
	return docsMode() !== "off";
}

export function docsIndexable(): boolean {
	return docsMode() === "public";
}
