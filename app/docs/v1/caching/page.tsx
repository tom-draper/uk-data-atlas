import { RequestSamples } from "@/components/docs/CodePanel";
import { Callout, DocPage, H2, List, P } from "@/components/docs/Content";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Caching",
	"How the UK Data Atlas API uses ETags and conditional requests so you only download data when it has changed.",
	"/docs/v1/caching",
);

const URL = `${API_BASE_URL}/measures/population-estimate`;

const CONDITIONAL = [
	{
		language: "curl" as const,
		label: "cURL",
		code: `# The first request returns an ETag header
curl -i "${URL}"

# Send it back; an unchanged resource answers 304 with no body
curl -i "${URL}" \\
  -H 'If-None-Match: "<etag from the first response>"'`,
	},
	{
		language: "javascript" as const,
		label: "JavaScript",
		code: `const first = await fetch("${URL}");
const etag = first.headers.get("etag");

const again = await fetch("${URL}", {
  headers: { "If-None-Match": etag },
});

if (again.status === 304) {
  // Nothing changed: keep using what you already have
}`,
	},
	{
		language: "python" as const,
		label: "Python",
		code: `import requests

url = "${URL}"
first = requests.get(url)
etag = first.headers["ETag"]

again = requests.get(url, headers={"If-None-Match": etag})

if again.status_code == 304:
    pass  # Nothing changed: keep using what you already have`,
	},
];

export default function CachingPage() {
	return (
		<DocPage
			href="/docs/v1/caching"
			eyebrow="Using the API"
			title="Caching"
			lede="Data only changes when a new Atlas release is published, so most requests can be answered from a cache. The API gives you everything you need to avoid downloading the same thing twice."
			toc={[
				{ id: "headers", title: "What the API sends" },
				{ id: "conditional", title: "Conditional requests" },
				{ id: "pinned", title: "Resources that never change" },
			]}
		>
			<H2 id="headers">What the API sends</H2>
			<List
				items={[
					"`ETag`: a fingerprint of the exact bytes in the response.",
					"`Cache-Control: public, max-age=300, must-revalidate`, so a cache can reuse a response for five minutes, then check it's still current.",
					"Errors are sent with `Cache-Control: no-store`, so a temporary problem is never cached.",
				]}
			/>

			<H2 id="conditional">Conditional requests</H2>
			<P>
				Send a response's `ETag` back in an `If-None-Match` header. If
				nothing has changed, you get `304 Not Modified` with an empty
				body, which is quick and costs almost nothing:
			</P>
			<RequestSamples samples={CONDITIONAL} />
			<Callout tone="tip">
				Browsers and most HTTP caches do this for you automatically.
			</Callout>

			<H2 id="pinned">Resources that never change</H2>
			<P>
				Map resources requested under a specific [Atlas
				release](/docs/v1/concepts/releases#pinning) are sent with
				`Cache-Control: public, max-age=31536000, immutable`. They can
				be cached for good.
			</P>
		</DocPage>
	);
}
