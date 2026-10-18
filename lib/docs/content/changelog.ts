/**
 * Changes to the API that a client might notice, newest first. Add an entry
 * whenever `pnpm contract:surface` locks a change to the v1 surface, with the
 * fingerprint it prints, and say plainly whether existing requests break.
 * tests/docs/changelog.test.ts fails while the locked surface has no entry.
 */

export interface ChangelogEntry {
	/** YYYY-MM-DD, the day the change was deployed. */
	date: string;
	title: string;
	/** Markdown, one item per change. */
	changes: string[];
	/** True when a request that worked before may now fail or answer differently. */
	breaking?: boolean;
	/**
	 * The fingerprint `pnpm contract:surface` prints for the surface this
	 * entry locked. Leave it off an entry that didn't change the surface.
	 */
	surface?: string;
}

export const CHANGELOG: ChangelogEntry[] = [
	{
		date: "2026-10-18",
		title: "Bound large geometry collections",
		breaking: true,
		changes: [
			"Children geometry now refuses collections with more than 1,000 children. Children geometry and box queries with a `tier` refuse requests that process more than 250,000 source vertices before simplification with `422 Geometry Budget Exceeded`.",
			"For box queries, reduce `limit` or omit `tier` to fetch identities. For larger geometry collections, follow the refusal's `links.downloads` to the release metadata and its prebuilt downloads. Oversized requests return no partial collection.",
		],
	},
	{
		date: "2026-10-17",
		title: "Early access opens",
		surface: "414774775552",
		changes: [
			"The API is live at `/v1`. Routes, parameters and responses may still change while it's in [early access](/docs/v1/early-access).",
		],
	},
];
