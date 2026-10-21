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
		date: "2026-10-21",
		title: "Serve website place and catalogue artifacts",
		surface: "52834368e3ba",
		changes: [
			"The API now serves website place profiles, facts, ward areas and the docs catalogue at `/v1/atlas-pages/{page-id}.json`. Containment and lineage lookups are available at `/v1/atlas-lookups/{lookup-id}.json`. Existing requests are unchanged; artifact shapes follow the website.",
		],
	},
	{
		date: "2026-10-18",
		title: "Queue requests when a worker is busy",
		changes: [
			"A request that arrives while a worker is at its concurrent request limit now waits up to one second for a free slot instead of being refused at once. `503 Server Busy` is now returned only when the wait times out or too many requests are already waiting. Self-hosted instances can tune this with `ATLAS_MAX_QUEUED_REQUESTS` and `ATLAS_QUEUE_TIMEOUT_MS`.",
		],
	},
	{
		date: "2026-10-18",
		title: "Bound map join output work",
		surface: "c9428ec181be",
		breaking: true,
		changes: [
			"Map-resource joins in JSON and Parquet now accept at most 250,000 source records and 16 MiB of uncompressed column payload. Oversized joins return `422 Map Join Budget Exceeded`, with no partial table. Follow `links.data` to retrieve source observations in pages as JSON, CSV or NDJSON.",
		],
	},
	{
		date: "2026-10-18",
		title: "Limit concurrent requests per worker",
		breaking: true,
		changes: [
			"A worker now admits at most 16 active requests by default, configurable with `ATLAS_MAX_CONCURRENT_REQUESTS`. Excess requests return `503 Server Busy` with `Retry-After: 1` without queuing. Retry with backoff. Health, readiness, metrics and preflight requests remain available.",
		],
	},
	{
		date: "2026-10-18",
		title: "Bound large geometry collections",
		surface: "5f2bbbf9901a",
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
