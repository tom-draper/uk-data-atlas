import CodePanel from "@/components/docs/CodePanel";
import {
	Callout,
	DocPage,
	H2,
	List,
	P,
	Table,
} from "@/components/docs/Content";
import { docsMetadata } from "@/lib/docs/metadata";

export const metadata = docsMetadata(
	"Responses",
	"The shape of every UK Data Atlas API response: the data envelope, the Atlas release, and the few responses served as plain files.",
	"/docs/v1/responses",
);

const ENVELOPE = `{
  "apiVersion": "v1",
  "atlasRelease": "sha256:9377970cfffdd2f92b153ba2ac76190812fc8925f5d65498d0e5149dfc0b1b5d",
  "data": {
    "…": "the result you asked for"
  },
  "meta": {
    "nextCursor": null
  }
}`;

export default function ResponsesPage() {
	return (
		<DocPage
			href="/docs/v1/responses"
			eyebrow="Using the API"
			title="Responses"
			lede="Every JSON response has the same simple shape, so once you've read one, you can read them all."
			toc={[
				{ id: "envelope", title: "The envelope" },
				{ id: "reading", title: "Reading a response" },
				{ id: "files", title: "Files and tiles" },
			]}
		>
			<H2 id="envelope">The envelope</H2>
			<P>Successful JSON responses look like this:</P>
			<CodePanel title="Response" language="json" code={ENVELOPE} />
			<Table
				head={["Field", "What it holds"]}
				rows={[
					[
						"`data`",
						"The result you asked for. Its shape is shown on each endpoint's page.",
					],
					[
						"`atlasRelease`",
						"The [Atlas release](/docs/v1/concepts/releases) that produced this response.",
					],
					[
						"`meta.nextCursor`",
						"The cursor for the next page, or `null` if this is the last. See [Pagination](/docs/v1/pagination).",
					],
					[
						"`apiVersion`",
						"Always `v1` for this version of the API.",
					],
				]}
			/>

			<H2 id="reading">Reading a response</H2>
			<P>
				Data responses also explain themselves. Look inside `data` and
				you'll typically find:
			</P>
			<List
				items={[
					"The `measure`, with its unit and whether it can be added up.",
					"Which areas and period the values describe.",
					"`provenance`, linking the values to their source dataset, and stating plainly whether anything was transformed.",
					"`coverage`, saying which nations or areas are included, and why any aren't.",
				]}
			/>
			<Callout tone="tip">
				If you're building something people will rely on, store
				`atlasRelease` with your results. It lets you reproduce them
				exactly.
			</Callout>

			<H2 id="files">Files and tiles</H2>
			<P>
				A few endpoints return a file rather than an envelope: [whole
				dataset
				downloads](/docs/v1/reference/sync/download-bulk-export),
				[lookup tables](/docs/v1/reference/sync/download-bulk-lookup),
				[vector tiles](/docs/v1/reference/geography/map-resource-tile),
				the [tile
				archive](/docs/v1/reference/geography/map-resource-archive) and
				the [OpenAPI
				spec](/docs/v1/reference/start-here/openapi-description). Each
				says so on its reference page.
			</P>
			<P>
				Errors are never wrapped in the envelope either. They have a
				shape of their own, described in [Errors](/docs/v1/errors).
			</P>
		</DocPage>
	);
}
