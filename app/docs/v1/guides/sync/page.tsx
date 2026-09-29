import { DocPage, P, Step, Steps } from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import { RequestSamples } from "@/components/docs/CodePanel";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Keep a copy in sync",
	"A step-by-step guide to loading current UK Data Atlas data into your own database and verifying each download.",
	"/docs/v1/guides/sync",
);

const API = API_BASE_URL;

const VERIFY = [
	{
		language: "javascript" as const,
		label: "JavaScript",
		code: `import { createHash } from "node:crypto";

const response = await fetch("${API}/exports/total-jobs-observations");
const { contentHash, ...content } = await response.json();

const recomputed = "sha256:" + createHash("sha256")
  .update(JSON.stringify(content))
  .digest("hex");

if (recomputed !== contentHash) {
  throw new Error("The download doesn't match its published hash");
}`,
	},
];

const CHANGES = [
	{
		language: "javascript" as const,
		label: "JavaScript",
		code: `import { readFile, writeFile } from "node:fs/promises";

// The manifest you kept from your last run, and the current one.
const kept = JSON.parse(await readFile("atlas-release.json", "utf8"));
const current = (await (await fetch("${API}/atlas-release")).json()).data;

const before = kept.resources.exports;
const after = current.resources.exports;
const fetchNow = Object.keys(after).filter((id) => before[id] !== after[id]);
const drop = Object.keys(before).filter((id) => !(id in after));

// Fetch fetchNow, delete drop, then keep the current manifest.
await writeFile("atlas-release.json", JSON.stringify(current));`,
	},
];

export default function SyncGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/sync"
			eyebrow="Guide"
			title="Keep a copy in sync"
			lede="Loading the data into your own database or warehouse? This guide shows how to take whole datasets in one go, prove they arrived intact, and fetch only what changed on your next run."
			toc={[
				{ id: "pin", title: "Record the release" },
				{ id: "download", title: "Download a dataset" },
				{ id: "verify", title: "Verify it" },
				{ id: "revalidate", title: "Check for changes cheaply" },
				{ id: "changes", title: "Fetch only what changed" },
				{ id: "lookups", title: "Add the lookup tables" },
			]}
		>
			<Steps>
				<Step id="pin" title="Record the release">
					<P>
						Record which Atlas release you're loading. Its
						`releaseId` identifies exactly the data you have.
					</P>
					<Request
						url={`${API}/atlas-release`}
						operationId="getAtlasRelease"
					/>
				</Step>

				<Step id="download" title="Download a dataset">
					<P>
						List the downloads, pick one, and fetch it as a single
						file. Each entry gives its `id`, `recordCount` and
						`contentHash`.
					</P>
					<Request
						url={`${API}/exports`}
						operationId="listBulkExports"
					/>
					<Request
						url={`${API}/exports/total-jobs-observations`}
						operationId="downloadBulkExport"
					/>
				</Step>

				<Step id="verify" title="Verify it">
					<P>
						Check the file's `contentHash` matches the one in the
						list. To be certain, recalculate it: it's the SHA-256 of
						the file without its own `contentHash` field.
					</P>
					<RequestSamples samples={VERIFY} />
				</Step>

				<Step id="revalidate" title="Check for changes cheaply">
					<P>
						On your next scheduled run, send the download's `ETag`
						back in `If-None-Match`. If nothing changed you get a
						`304` with no body. [Caching](/docs/v1/caching) has
						examples.
					</P>
				</Step>

				<Step id="changes" title="Fetch only what changed">
					<P>
						The API only serves the current release, so keep the
						manifest from your last run. Its `resources` give a
						fingerprint for every dataset, measure, crosswalk,
						export and lookup, which changes exactly when that
						resource does. Compare the kept fingerprints with the
						current ones, fetch what was added or changed, and drop
						what was removed.
					</P>
					<RequestSamples samples={CHANGES} />
				</Step>

				<Step id="lookups" title="Add the lookup tables">
					<P>
						Finally, take the reference tables you'll join against,
						such as area codes and names, as CSV or NDJSON.
					</P>
					<Request
						url={`${API}/lookups`}
						operationId="listBulkLookups"
					/>
				</Step>
			</Steps>
		</DocPage>
	);
}
