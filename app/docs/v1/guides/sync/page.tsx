import { Callout, DocPage, P, Step, Steps } from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import { RequestSamples } from "@/components/docs/CodePanel";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Keep a copy in sync",
	"A step-by-step guide to loading UK Data Atlas data into your own database: pin a release, download whole datasets, verify them and refresh only what changed.",
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

export default function SyncGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/sync"
			eyebrow="Guide"
			title="Keep a copy in sync"
			lede="Loading the data into your own database or warehouse? This guide shows how to take whole datasets in one go, prove they arrived intact, and refresh only what changed."
			toc={[
				{ id: "pin", title: "Pin the release" },
				{ id: "download", title: "Download a dataset" },
				{ id: "verify", title: "Verify it" },
				{ id: "revalidate", title: "Check for changes cheaply" },
				{ id: "compare", title: "Refresh what moved" },
				{ id: "lookups", title: "Add the lookup tables" },
			]}
		>
			<Steps>
				<Step id="pin" title="Pin the release">
					<P>
						Record which Atlas release you're loading. Its
						`releaseId` identifies exactly the data you have.
					</P>
					<Request url={`${API}/atlas-release`} />
				</Step>

				<Step id="download" title="Download a dataset">
					<P>
						List the downloads, pick one, and fetch it as a single
						file. Each entry gives its `id`, `recordCount` and
						`contentHash`.
					</P>
					<Request url={`${API}/exports`} />
					<Request url={`${API}/exports/total-jobs-observations`} />
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

				<Step id="compare" title="Refresh what moved">
					<P>
						When there's a new release, compare it with the one you
						pinned. The summary lists what was added, removed and
						changed, so you only reload those.
					</P>
					<Request
						url={`${API}/atlas-releases/compare?from={your-pinned-release-id}`}
					/>
					<Callout tone="tip">
						Leave out `to` to compare against the current release.
					</Callout>
				</Step>

				<Step id="lookups" title="Add the lookup tables">
					<P>
						Finally, take the reference tables you'll join against,
						such as area codes and names, as CSV or NDJSON.
					</P>
					<Request url={`${API}/lookups`} />
				</Step>
			</Steps>
		</DocPage>
	);
}
