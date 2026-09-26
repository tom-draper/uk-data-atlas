import {
	Callout,
	DocPage,
	EndpointRef,
	H2,
	List,
	P,
	Table,
} from "@/components/docs/Content";
import { Request, SpecExample } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"CSV and bulk downloads",
	"Get UK Data Atlas API data as CSV or NDJSON, or download whole datasets, lookup tables and tile archives in a single request.",
	"/docs/v1/formats",
);

export default function FormatsPage() {
	return (
		<DocPage
			href="/docs/v1/formats"
			eyebrow="Using the API"
			title="CSV and bulk downloads"
			lede="JSON is the default, but you don't have to use it. Ask for CSV to open results in a spreadsheet, or download a whole dataset in a single request."
			toc={[
				{ id: "format", title: "Choosing a format" },
				{ id: "csv", title: "What CSV looks like" },
				{ id: "bulk", title: "Whole datasets" },
				{ id: "lookups", title: "Lookup tables" },
				{ id: "tiles", title: "Map tiles" },
			]}
		>
			<H2 id="format">Choosing a format</H2>
			<P>
				Endpoints that offer more than one format take a `format`
				parameter:
			</P>
			<Table
				head={["Format", "Best for"]}
				rows={[
					["`json`", "Apps and scripts. The default."],
					["`csv`", "Spreadsheets, and tools like pandas or R."],
					["`ndjson`", "Streaming, with one JSON record per line."],
				]}
			/>
			<Request
				url={`${API_BASE_URL}/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&format=csv`}
			/>
			<P>
				The API picks the format from this parameter only, not the
				`Accept` header.
			</P>

			<H2 id="csv">What CSV looks like</H2>
			<List
				items={[
					"Each row carries its own provenance, so a saved file still says where it came from.",
					"Rows include the measure's `unit`, so values can't be misread.",
					"`lowerBound` and `upperBound` columns hold any published confidence interval, and are empty otherwise.",
					"In lookup tables, a list is joined with ` | ` in a single cell.",
				]}
			/>

			<H2 id="bulk">Whole datasets</H2>
			<P>
				Paging through a big dataset takes many requests. Instead, list
				the downloads on offer and fetch the one you want as a single
				file:
			</P>
			<SpecExample id="listBulkExports" showResponse={false} />
			<Callout tone="tip">
				Each download has a `contentHash`. Check it after downloading to
				be sure you got exactly the file that was published. [Keep a
				copy in sync](/docs/v1/guides/sync) shows how.
			</Callout>
			<EndpointRef id="downloadBulkExport" />

			<H2 id="lookups">Lookup tables</H2>
			<P>
				Lookup tables are the reference data you join against: area
				codes and names for each boundary release, crosswalks as one row
				per mapping, and named-location membership. Download them as CSV
				or NDJSON:
			</P>
			<SpecExample id="downloadBulkLookup" showResponse={false} />

			<H2 id="tiles">Map tiles</H2>
			<P>
				Boundaries for maps come as vector tiles, or as one PMTiles
				archive holding every tile for a release. See [Draw a
				map](/docs/v1/guides/map#tiles).
			</P>
		</DocPage>
	);
}
