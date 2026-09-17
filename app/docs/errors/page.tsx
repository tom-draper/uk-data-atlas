import CodePanel, { RequestSamples } from "@/components/docs/CodePanel";
import { Callout, DocPage, H2, P, Table } from "@/components/docs/Content";
import { ERROR_CODES } from "@/lib/docs/content/errors";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL, loadApiContract } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Errors",
	"What UK Data Atlas API errors look like, what each status and error code means, and how to handle them.",
	"/docs/errors",
);

const PROBLEM = `{
  "type": "https://api.ukdataatlas.com/problems/operation-not-supported",
  "title": "Operation Not Supported",
  "status": 422,
  "detail": "This measure is a median and cannot be combined over areas.",
  "code": "aggregation_not_supported"
}`;

const URL = `${API_BASE_URL}/data/house-price-median/aggregate?period=2022&geography=ward&boundaryYear=2020&areaCode=E92000001`;

const HANDLING = [
	{
		language: "javascript" as const,
		label: "JavaScript",
		code: `const response = await fetch(
  "${URL}",
);

if (!response.ok) {
  const problem = await response.json();

  if (problem.code === "aggregation_not_supported") {
    // Show each area's value instead of a total
  }
  throw new Error(\`\${problem.title}: \${problem.detail}\`);
}`,
	},
	{
		language: "python" as const,
		label: "Python",
		code: `import requests

response = requests.get(
    "${API_BASE_URL}/data/house-price-median/aggregate",
    params={
        "period": "2022",
        "geography": "ward",
        "boundaryYear": "2020",
        "areaCode": "E92000001",
    },
)

if not response.ok:
    problem = response.json()

    if problem.get("code") == "aggregation_not_supported":
        pass  # Show each area's value instead of a total
    raise RuntimeError(f"{problem['title']}: {problem['detail']}")`,
	},
];

const STATUSES: [string, string][] = [
	["`200` OK", "It worked."],
	[
		"`204` No Content",
		"It worked, and there's nothing to send, such as a map tile with no areas in it.",
	],
	[
		"`304` Not Modified",
		"Your cached copy is still current. See [Caching](/docs/caching).",
	],
	[
		"`400` Bad Request",
		"A parameter is missing or malformed. `detail` says which.",
	],
	[
		"`404` Not Found",
		"Nothing matches what you asked for, such as an unknown measure or area code.",
	],
	[
		"`409` Conflict",
		"What you asked for is ambiguous. The response lists the choices.",
	],
	["`410` Gone", "That Atlas release is no longer served."],
	[
		"`422` Unprocessable",
		"The request is clear, but answering it would be misleading, so the API declines.",
	],
	["`503` Unavailable", "The data isn't ready yet. Try again shortly."],
];

export default function ErrorsPage() {
	const codes = loadApiContract().problemCodes;
	return (
		<DocPage
			href="/docs/errors"
			eyebrow="Using the API"
			title="Errors"
			lede="When something goes wrong, the API tells you what happened and why, in the same format every time. Many errors are deliberate: the API would rather refuse than hand you a number that looks right but isn't."
			toc={[
				{ id: "shape", title: "What an error looks like" },
				{ id: "statuses", title: "Status codes" },
				{ id: "codes", title: "Error codes" },
				{ id: "handling", title: "Handling errors" },
			]}
		>
			<H2 id="shape">What an error looks like</H2>
			<P>
				Errors follow the Problem Details standard (RFC 9457) and are
				always sent as `application/problem+json`, whatever format you
				asked for:
			</P>
			<CodePanel title="Error" language="json" code={PROBLEM} />
			<P>
				`title` and `detail` are written for people. `code` is stable,
				so branch on that in your code. Some errors add more, like the
				`choices` for an ambiguous place name.
			</P>

			<H2 id="statuses">Status codes</H2>
			<Table head={["Status", "What it means"]} rows={STATUSES} />

			<H2 id="codes">Error codes</H2>
			<P>
				These are the `code` values you can rely on, with what to do
				about each:
			</P>
			<Table
				head={["Code", "What happened", "What to do"]}
				rows={codes.map((code) => {
					const content = ERROR_CODES[code];
					return [
						<span key="code" className="whitespace-nowrap">
							<code className="font-mono text-[13px] text-slate-900">
								{code}
							</code>
							<span className="mt-1 block text-[12px] text-slate-400">
								{content.status}
							</span>
						</span>,
						content.meaning,
						content.fix,
					];
				})}
			/>

			<H2 id="handling">Handling errors</H2>
			<P>
				Check the status, then branch on `code` for the cases you want
				to handle. Here, asking for a total of median house prices is
				refused:
			</P>
			<RequestSamples samples={HANDLING} />
			<Callout tone="note">
				A `422` isn't a bug in your code. It usually means there's a
				better question to ask, and `detail` points you towards it.
			</Callout>
		</DocPage>
	);
}
