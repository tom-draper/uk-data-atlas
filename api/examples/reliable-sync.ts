import { createHash } from "node:crypto";
import { type AtlasClient, createClient, type Step } from "./client";

/**
 * Reliable sync: ingest current data and verify what arrived.
 *
 * The Atlas release is the version of everything. A warehouse pins it, checks
 * each download against the hash the manifest publishes, and records the
 * release id alongside the imported data.
 */
export const run = async (client: AtlasClient): Promise<Step[]> => {
	const steps: Step[] = [];

	// 1. Record the release. Every response names it, so a table can record the
	//    exact set of artifacts it was built from.
	const release = await client.get<{
		releaseId: string;
		artifacts: unknown[];
	}>("/v1/atlas-release");
	steps.push({
		title: "Record the Atlas release",
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

	// 3. Verify it against the hash the manifest published.
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

	// 5. The reference tables a warehouse joins against, as whole files.
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
