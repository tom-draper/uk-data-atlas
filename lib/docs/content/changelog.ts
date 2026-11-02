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
	/**
	 * The `atlas-release` id (`sha256:` and 64 hex digits) of the first build
	 * that carried this change, as `GET /v1/atlas-release` and the
	 * `atlas-release` response header give it. Copy it from the deployed
	 * build, and leave it off an entry whose build is unknown.
	 */
	release?: string;
}

export const CHANGELOG: ChangelogEntry[] = [
	{
		date: "2026-11-02",
		title: "Measures with dimension filters",
		surface: "9958d13497e9",
		breaking: true,
		changes: [
			"A measure is now the thing measured, and its breakdowns are dimensions: `recorded-crimes` with `offence=burglary` rather than `crime-burglary`, `party-vote-share` with `party=lab` rather than `general-election-lab-vote-share`. The data routes and a map join take each dimension as a query parameter, or as `dimensions[offence]=burglary`, with one member, several separated by commas, or `*` for all. A dimension left out takes its total where one is published, and the response says which member it used in `defaults` and `dimensions`.",
			"`/value` and `/series` answer several members at once as `data.breakdown`, one entry per series, so every crime type for a place, or every ethnic group in an LSOA, is one request. Other operations answer one series and refuse several with the new `ambiguous_dimension` problem and a request for each in `choices`. New 400 problems `unknown_dimension`, `unknown_dimension_member` and `conflicting_dimension_filter`, and a 404 `no_matching_series`, say what was wrong and what to ask instead.",
			"`GET /v1/measures` lists 51 measures instead of 228 ids. Each lists its `dimensions` and their members, with labels, and its `series`, one per combination of members, with sources and the old id it replaces. `?q=` searches member names too, so `burglary` and `Labour vote share` find their measure and say which member to filter on in `matchedMembers`. Some measures' labels change to the statistics tables' names, such as `Population` for `population`; the old label stays in `seriesLabel`.",
			"Every old id still works wherever a measure id is accepted. It is read as its measure with its members fixed, the response names it in `resolvedFrom`, and it carries a `Deprecation` header. The old ids are listed, with what each resolves to, as `DeprecatedMeasureAlias` in the OpenAPI document. They have no sunset date.",
		],
	},
	{
		date: "2026-11-01",
		title: "Find similar areas across selected measures",
		surface: "204216231d17",
		changes: [
			"`GET /v1/areas/{geography}/{code}/similar` finds areas nearest to a target across one to ten numeric measures for one period. It reports the selected method, each measure's scaling statistics, excluded areas, and the values behind each result. Existing requests are unchanged.",
		],
	},
	{
		date: "2026-10-30",
		title: "Rename /v1/geographies to /v1/boundaries",
		surface: "29b2f2539ba8",
		breaking: true,
		changes: [
			"The list of the kinds of area the Atlas holds, each with its latest boundary release, moves from `/v1/geographies` to `/v1/boundaries`, and its operation is now `listBoundaries`. The response is unchanged. `/v1/geographies` answers `308 Permanent Redirect` to the new path, so a client that follows redirects keeps working.",
			"The `links` object on an `unsupported_geography` problem names this list as `boundaries` instead of `geographies`.",
			"The reference page for the list moves to [List boundaries](/docs/v1/reference/geography/list-boundaries), and the old address redirects to it.",
		],
	},
	{
		date: "2026-10-26",
		title: "Deprecate superseded boundary releases",
		surface: "f3c7fb60d63f",
		changes: [
			'A boundary release can now be deprecated. `/v1/boundary-releases` and each release\'s resource carry a `deprecation` record with `deprecated`, an optional `sunset`, `replacedBy` and `reason`. Every response about a deprecated release, including its areas and downloads, sends `Deprecation` and `Sunset` headers and a `Link` with `rel="successor-version"` to the replacement. `/v1/boundary-releases:resolve` and `latest` never choose a deprecated release while its replacement covers the date. No request that worked before fails.',
			"`lsoa/2001-12-ew-bgc`, the thinned 2001 LSOA boundaries, is deprecated in favour of `lsoa/2001-12-ew-bgc-v2`, the publisher's unthinned geometry. It stays published and has no sunset date yet.",
		],
	},
	{
		date: "2026-10-26",
		title: "Publish llms.txt and curl examples",
		changes: [
			"`/llms.txt` on this site lists the front-door routes with a `curl` request for each, and `/llms-full.txt` adds their parameters. Each of those routes' [reference pages](/docs/v1/reference) now has a **Try it** example. The API is unchanged.",
		],
	},
	{
		date: "2026-10-26",
		title: "Identify release artifacts by their stored bytes",
		surface: "2b61c1fc50d5",
		breaking: true,
		changes: [
			"The `/v1/atlas-release` manifest uses `artifacts` to list release files and their hashes. The former `resources` field is removed. Read `artifacts` for the files in the current build, and use the export and map catalogues to discover downloads.",
		],
	},
	{
		date: "2026-10-22",
		title: "Serve CSV exports gzipped",
		surface: "679ec488e471",
		breaking: true,
		changes: [
			"Each format listed by `/v1/exports` may now carry `gzipBytes`: present when the file is stored gzipped, as CSV is, giving its size as sent with `Content-Encoding: gzip`.",
			"A CSV export is no longer served in byte ranges: a request with `Range` gets the whole file. Download it in one request instead.",
		],
	},
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
