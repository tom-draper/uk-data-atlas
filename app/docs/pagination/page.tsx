import { RequestSamples } from "@/components/docs/CodePanel";
import { Callout, DocPage, H2, List, P } from "@/components/docs/Content";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Pagination",
	"How to page through long lists in the UK Data Atlas API with limit and cursors, with ready-to-use code in JavaScript and Python.",
	"/docs/pagination",
);

const URL = `${API_BASE_URL}/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=500`;

const LOOP_SAMPLES = [
	{
		language: "javascript" as const,
		label: "JavaScript",
		code: `const url = new URL(
  "${URL}",
);
const records = [];

while (true) {
  const response = await fetch(url);
  const { data, meta } = await response.json();
  records.push(...data.records);

  if (meta.nextCursor === null) break;
  url.searchParams.set("cursor", meta.nextCursor);
}`,
	},
	{
		language: "python" as const,
		label: "Python",
		code: `import requests

params = {
    "period": "2022",
    "geography": "ward",
    "boundaryYear": "2023",
    "limit": 500,
}
records = []

while True:
    response = requests.get(
        "${API_BASE_URL}/data/population-estimate",
        params=params,
    )
    response.raise_for_status()
    body = response.json()
    records.extend(body["data"]["records"])

    if body["meta"]["nextCursor"] is None:
        break
    params["cursor"] = body["meta"]["nextCursor"]`,
	},
];

export default function PaginationPage() {
	return (
		<DocPage
			href="/docs/pagination"
			eyebrow="Using the API"
			title="Pagination"
			lede="Long lists, like every ward in England and Wales, come back a page at a time. Fetching the next page is a single parameter."
			toc={[
				{ id: "how", title: "How it works" },
				{ id: "loop", title: "Fetching every page" },
				{ id: "tables", title: "Pages of CSV" },
			]}
		>
			<H2 id="how">How it works</H2>
			<List
				items={[
					"Set `limit` to choose the page size. Most endpoints return 100 records by default and up to 500 at a time.",
					"Each response's `meta.nextCursor` holds a cursor for the next page, or `null` on the last page.",
					"Pass that value back as `cursor`, with the rest of your query unchanged, to get the next page.",
				]}
			/>
			<Callout tone="warning">
				A cursor only works with the query that issued it. Change
				another parameter and it's refused with `invalid_cursor`, so
				start again from the first page instead.
			</Callout>

			<H2 id="loop">Fetching every page</H2>
			<P>This loop collects every ward's population for 2022:</P>
			<RequestSamples samples={LOOP_SAMPLES} />
			<Callout tone="tip">
				Want a whole dataset? [Download it in one
				go](/docs/formats#bulk) instead of paging through it.
			</Callout>

			<H2 id="tables">Pages of CSV</H2>
			<P>
				A CSV or NDJSON page has nowhere to put a cursor, so the next
				page's URL comes in the `Link` response header instead, marked
				`rel="next"`. The last page has no `Link` header.
			</P>
		</DocPage>
	);
}
