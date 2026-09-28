import { RequestSamples } from "@/components/docs/CodePanel";
import {
	Callout,
	DocPage,
	H2,
	List,
	P,
	Table,
} from "@/components/docs/Content";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Rate limits",
	"How the UK Data Atlas API shares capacity between clients, what the RateLimit headers mean, and how to back off when you're refused.",
	"/docs/v1/rate-limits",
);

const URL = `${API_BASE_URL}/measures/population-estimate`;

const HEADERS: [string, string][] = [
	[
		"`RateLimit-Policy`",
		'`"default";q=600;w=60` — the bucket holds 600 requests and takes 60 seconds to refill from empty.',
	],
	[
		"`RateLimit`",
		'`"default";r=487;t=12` — you have 487 requests left, and the bucket is full again in 12 seconds.',
	],
	[
		"`Retry-After`",
		"Sent only with a `429`. The whole seconds to wait before the refused request would be affordable.",
	],
];

const BACKOFF = [
	{
		language: "javascript" as const,
		label: "JavaScript",
		code: `async function get(url) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url);
    if (response.status !== 429) return response;

    // Retry-After is authoritative; only guess if it's missing.
    const wait = Number(response.headers.get("retry-after") ?? 2 ** attempt);
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
  }
}`,
	},
	{
		language: "python" as const,
		label: "Python",
		code: `import time
import requests


def get(url):
    attempt = 0
    while True:
        response = requests.get(url)
        if response.status_code != 429:
            return response

        # Retry-After is authoritative; only guess if it's missing.
        wait = int(response.headers.get("Retry-After", 2**attempt))
        time.sleep(wait)
        attempt += 1`,
	},
	{
		language: "curl" as const,
		label: "cURL",
		code: `# --retry understands Retry-After on a 429
curl --retry 5 --retry-all-errors -i "${URL}"`,
	},
];

export default function RateLimitsPage() {
	return (
		<DocPage
			href="/docs/v1/rate-limits"
			eyebrow="Using the API"
			title="Rate limits"
			lede="The data is openly licensed and read-only, so the limit exists to stop one client starving the others, not to meter access. There are no API keys and nothing is held back behind one."
			toc={[
				{ id: "budget", title: "What you get" },
				{ id: "headers", title: "Reading the headers" },
				{ id: "refused", title: "When you're refused" },
				{ id: "staying-under", title: "Staying under the limit" },
			]}
		>
			<H2 id="budget">What you get</H2>
			<P>
				Each client has a token bucket. You may spend up to **600
				requests at once**, and you earn them back at **10 a second**.
				Spending the whole bucket and then waiting a minute puts you
				back where you started.
			</P>
			<P>
				A burst allowance matters more than an average here: drawing a
				map view is a rush of requests followed by nothing at all. A map
				that fetches its tiles and a join table does not come close to
				the bucket.
			</P>
			<Callout tone="tip">
				Clients are counted by address. An IPv6 client is counted by its
				`/64` prefix rather than a single address, because one machine
				is usually given the whole prefix.
			</Callout>

			<H2 id="headers">Reading the headers</H2>
			<P>
				Every response carries your budget, not just a refusal, so you
				can slow down before you're turned away. These are the fields of
				the IETF HTTPAPI draft:
			</P>
			<Table head={["Header", "What it says"]} rows={HEADERS} />

			<H2 id="refused">When you're refused</H2>
			<P>
				A request you cannot afford is answered with `429 Too Many
				Requests` as a [problem document](/docs/v1/errors), with
				`Retry-After` in seconds. Nothing is queued and nothing is
				charged for the refusal: waiting the stated time and sending it
				again is the whole recovery.
			</P>
			<List
				items={[
					"`Retry-After` is authoritative. Prefer it to a backoff schedule of your own.",
					"A `429` is sent with `Cache-Control: no-store`, so it never lands in a cache.",
					"The limit is applied by the server rather than the route, so any operation can answer with it.",
				]}
			/>
			<RequestSamples samples={BACKOFF} />

			<H2 id="staying-under">Staying under the limit</H2>
			<P>
				Most clients that hit the limit are re-fetching things that
				haven't changed, or fetching one row at a time. Both have a
				cheaper shape:
			</P>
			<List
				items={[
					"Send back the `ETag` you were given. A `304 Not Modified` still costs a request, but it costs no bandwidth. See [Caching](/docs/v1/caching).",
					"Take a whole table rather than a row at a time: [bulk downloads](/docs/v1/formats) serve an entire partition or lookup in one request.",
					"Pin an [Atlas release](/docs/v1/concepts/releases#pinning). A pinned resource is immutable and can be cached for good, so you never re-fetch it.",
					"Ask for a bigger page. `limit` accepts up to 500, so one request can replace ten.",
				]}
			/>
			<Callout tone="note">
				Running the API yourself? The bucket is set by
				`ATLAS_RATE_LIMIT_CAPACITY` and
				`ATLAS_RATE_LIMIT_REFILL_PER_SECOND`, and a capacity of `0`
				turns the limit off.
			</Callout>
		</DocPage>
	);
}
