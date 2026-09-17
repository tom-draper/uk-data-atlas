import { createHash } from "node:crypto";
import { type AtlasClient, createClient, type Step } from "./client";

/**
 * Reliable sync: ingest release-pinned data, verify what arrived, and
 * reprocess only what changed.
 *
 * The Atlas release is the version of everything. A warehouse pins it, checks
 * each download against the hash the manifest publishes, and asks what moved
 * between its pinned release and the current one rather than rebuilding.
 */
export const run = async (client: AtlasClient): Promise<Step[]> => {
	const steps: Step[] = [];

	// 1. Pin the release. Every response names it, so a table can record the
	//    exact set of artifacts it was built from.
	const release = await client.get<{
		releaseId: string;
		artifacts: unknown[];
	}>("/v1/atlas-release");
	steps.push({
		title: "Pin the Atlas release",
		detail: `${release.data.releaseId} covers ${release.data.artifacts.length} artifacts.`,
	});

	// 2. Take a whole partition as one immutable download, rather than paging
	//    a query and hoping the pages agree.
	const exports = await client.get<{
		exports: Array<{
			id: string;
			measureId: string;
			contentHash: string;
			recordCount: number;
		}>;
	}>("/v1/exports");
	const entry = exports.data.exports.find(
		(candidate) => candidate.measureId === "total-jobs",
	);
	if (!entry) throw new Error("no total-jobs export to sync");
	const download = await client.call(`/v1/exports/${entry.id}`);
	const body = JSON.stringify(download.body);
	steps.push({
		title: "Download a whole partition",
		detail: `${entry.id} is ${entry.recordCount.toLocaleString("en-GB")} records.`,
	});

	// 3. Verify it against the hash the manifest published. A mismatch means
	//    the bytes are not the ones the release pinned.
	const { contentHash, ...content } = download.body as {
		contentHash: string;
	};
	// The hash is taken over the artifact without its own hash field, so a
	// consumer can recompute it rather than trusting the label.
	const recomputed = `sha256:${createHash("sha256")
		.update(JSON.stringify(content))
		.digest("hex")}`;
	if (contentHash !== entry.contentHash)
		throw new Error(
			`${entry.id} arrived as ${contentHash}, not the manifest's ${entry.contentHash}`,
		);
	if (recomputed !== contentHash)
		throw new Error(
			`${entry.id} hashes to ${recomputed}, but claims ${contentHash}`,
		);
	steps.push({
		title: "Verify what arrived",
		detail: `Recomputed ${recomputed.slice(0, 19)}…, which is the hash the manifest and the artifact both give.`,
	});

	// 4. Revalidate cheaply. An unchanged resource answers 304 with no body,
	//    so a scheduled sync costs almost nothing while nothing moves.
	const etag = download.headers.get("etag");
	const revalidated = await client.call(`/v1/exports/${entry.id}`, {
		"if-none-match": etag ?? "",
	});
	if (revalidated.status !== 304)
		throw new Error(`revalidation answered ${revalidated.status}, not 304`);
	steps.push({
		title: "Revalidate without downloading",
		detail: `If-None-Match on ${etag?.slice(0, 16)}… answered 304, ${body.length.toLocaleString("en-GB")} bytes saved.`,
	});

	// 5. Ask what changed since the pinned release, so only affected tables
	//    are rebuilt.
	const history =
		await client.get<Array<{ releaseId: string; current: boolean }>>(
			"/v1/atlas-releases",
		);
	const previous = history.data.find((candidate) => !candidate.current);
	if (!previous) {
		// The first published release has nothing before it: a sync starting
		// here takes everything, and compares from its next run onwards.
		steps.push({
			title: "Reprocess only what moved",
			detail: `${history.data.length} release published, so there is nothing to compare yet; take everything and pin this release.`,
		});
	} else {
		const comparison = await client.get<{
			summary: { added: number; removed: number; changed: number };
			resources: Record<string, { changed?: unknown[] }>;
		}>(`/v1/atlas-releases/compare?from=${previous.releaseId}`);
		const changedKinds = Object.entries(comparison.data.resources)
			.filter(([, value]) => (value.changed?.length ?? 0) > 0)
			.map(([kind]) => kind);
		steps.push({
			title: "Reprocess only what moved",
			detail: `Against ${previous.releaseId.slice(0, 19)}…: ${comparison.data.summary.changed} artifacts changed${changedKinds.length > 0 ? `, in ${changedKinds.join(", ")}` : ""}.`,
		});
	}

	// 6. The reference tables a warehouse joins against, as whole files.
	const lookups = await client.get<{
		lookups: Array<{ id: string; rowCount: number }>;
	}>("/v1/lookups");
	const lookup = lookups.data.lookups[0];
	steps.push({
		title: "Take the lookup tables",
		detail: `${lookups.data.lookups.length} lookups, such as ${lookup?.id} at ${lookup?.rowCount.toLocaleString("en-GB")} rows.`,
	});
	return steps;
};

if (process.argv[1]?.endsWith("reliable-sync.ts")) {
	const client = createClient(
		process.env.BASE_URL ?? "http://127.0.0.1:3001",
	);
	for (const step of await run(client))
		console.log(`${step.title}: ${step.detail}`);
}
