import {
	Callout,
	DocPage,
	EndpointRef,
	H2,
	List,
	P,
	Table,
} from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Areas and boundaries",
	"How the UK Data Atlas API identifies areas: official area codes, geographies like wards and local authorities, and dated boundary releases.",
	"/docs/v1/concepts/areas",
);

export default function AreasPage() {
	return (
		<DocPage
			href="/docs/v1/concepts/areas"
			eyebrow="Concepts"
			title="Areas and boundaries"
			lede="Boundaries in the UK change all the time. Wards are redrawn, councils merge and constituencies are reshaped. The API keeps track of exactly which version of an area you mean, so your data and your maps always match."
			toc={[
				{ id: "codes", title: "Area codes" },
				{ id: "geographies", title: "Geographies" },
				{ id: "releases", title: "Boundary releases" },
				{ id: "identity", title: "Naming an exact area" },
				{ id: "data", title: "Which areas data is on" },
				{ id: "shapes", title: "Shapes" },
				{ id: "endpoints", title: "Useful endpoints" },
			]}
		>
			<H2 id="codes">Area codes</H2>
			<P>
				Every official area has a code. Birmingham City Council is
				`E08000025`, and a code's first letter usually tells you the
				country: `E` for England, `W` for Wales, `S` for Scotland and
				`N` for Northern Ireland. Some Northern Ireland statistics use
				their own codes, like `95AA01S1`.
			</P>
			<P>
				Codes are the reliable way to name an area. Names aren't unique,
				but codes are.
			</P>

			<H2 id="geographies">Geographies</H2>
			<P>A geography is a kind of area. You'll see these most often:</P>
			<Table
				head={["Geography", "What it is"]}
				rows={[
					[
						"`ward`",
						"Electoral wards, the building blocks of councils",
					],
					["`localAuthority`", "Councils, like Leeds or Cornwall"],
					[
						"`constituency`",
						"Westminster parliamentary constituencies",
					],
					["`region`", "The English regions, like the North West"],
					["`lsoa`", "Small statistical areas in England and Wales"],
					["`dataZone`", "Small statistical areas in Scotland"],
				]}
			/>
			<P>
				[List
				geographies](/docs/v1/reference/geography/list-geographies)
				returns every one the Atlas knows about.
			</P>

			<H2 id="releases">Boundary releases</H2>
			<P>
				A boundary release is a dated snapshot of one geography's
				boundaries, as its publisher released them. Its id tells you
				what it is:
			</P>
			<List
				items={[
					"`2024-07-uk-bgc` is the July 2024 release covering the UK.",
					"The middle part is the coverage, such as `uk`, `gb`, `ew` (England and Wales), `en` or `sc`.",
					"The last part is the publisher's boundary type: `bgc` is generalised and clipped to the coastline, and `bfc` is full resolution.",
				]}
			/>
			<Callout tone="tip">
				Not sure which release to use for a date? [Find boundaries for a
				date](/docs/v1/reference/geography/resolve-boundary-release-for-date)
				picks the right one.
			</Callout>

			<H2 id="identity">Naming an exact area</H2>
			<P>
				Because the same code can appear in several releases, an area's
				full identity has three parts: its geography, its boundary
				release and its code. You'll see them together in URLs:
			</P>
			<Request
				url={`${API_BASE_URL}/areas/constituency/2024-07-uk-bgc/E14001262`}
			/>

			<H2 id="data">Which areas data is on</H2>
			<P>
				Publishers release statistics against the area codes that were
				current when they made them. When you ask for data, you name
				that set of codes with two parameters:
			</P>
			<List
				items={[
					"`geography`: the kind of area the publisher used, such as `ward`.",
					"`boundaryYear`: the year of the codes they used, such as `2023`.",
				]}
			/>
			<P>
				This doesn't choose which boundaries to draw. To put values on a
				map, add a `release`. The API only accepts one that contains
				every area code in the data, so nothing silently goes missing.
				[Check which boundaries
				fit](/docs/v1/reference/data-catalogue/measure-compatibility)
				lists the releases that work.
			</P>

			<H2 id="shapes">Shapes</H2>
			<P>
				Shapes come back as GeoJSON in ordinary longitude and latitude
				(WGS 84). Full detail can be heavy, so geometry endpoints take a
				`tier` of `full`, `high`, `medium` or `low`. `medium` or `low`
				is usually right for web maps.
			</P>

			<H2 id="endpoints">Useful endpoints</H2>
			<EndpointRef id="listBoundaryReleases" />
			<EndpointRef id="getArea" />
			<EndpointRef id="validateAreaValues" />
			<EndpointRef id="getAreaGeometry" />
		</DocPage>
	);
}
