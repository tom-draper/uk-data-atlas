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
import {
	loadCatalogue,
	releasesForGeography,
	type Catalogue,
} from "@/lib/docs/catalogue";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Areas and boundaries",
	"How the UK Data Atlas API identifies areas: official area codes, geographies like wards and local authorities, and dated boundary releases.",
	"/docs/v1/concepts/areas",
);

/** The year a geography's oldest release in the Atlas is from. */
function firstYear(catalogue: Catalogue, geography: string): string {
	return releasesForGeography(catalogue, geography).at(-1)!.id.slice(0, 4);
}

export default async function AreasPage() {
	const catalogue = await loadCatalogue();
	const since = `${firstYear(catalogue, "localAuthority")} for local authorities, ${firstYear(catalogue, "ward")} for wards and ${firstYear(catalogue, "constituency")} for constituencies`;
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
				{ id: "containment", title: "What an area contains" },
				{ id: "history", title: "When areas change" },
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
				[List boundaries](/docs/v1/reference/geography/list-boundaries)
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
					"The last part is the publisher's boundary type: `bgc` (or `gcb` in a few older releases) is generalised and clipped to the coastline, and `bfc` is full resolution and clipped to the coastline.",
					"A suffix such as `-v2` marks a corrected edition the publisher reissued. A few releases from other publishers have shorter ids, like `2011-ni`.",
					"A year can have more than one release. Use the full id, including its month and coverage, when you need one exact set of shapes.",
				]}
			/>
			<Callout tone="tip">
				Not sure which release to use for a date? [Find boundaries for a
				date](/docs/v1/reference/geography/resolve-boundary-release-for-date)
				picks the right one. The [geography pages](/docs/v1/geographies)
				list every available release and its coverage.
			</Callout>
			<P>
				Moving to a newer release? [Compare boundary
				releases](/docs/v1/reference/geography/compare-boundary-releases)
				lists the codes the two share, the codes added and the codes
				gone, and where there's published evidence, whether a shared
				code's boundary stayed the same.
			</P>

			<H2 id="identity">Naming an exact area</H2>
			<P>
				Because the same code can appear in several releases, an area's
				full identity has three parts: its geography, its boundary
				release and its code. You'll see them together in URLs:
			</P>
			<Request
				url={`${API_BASE_URL}/areas/constituency/2024-07-uk-bgc/E14001262`}
			/>
			<P>
				To get every area in a release, such as all wards for a lookup
				table, list them a page at a time, or download the release whole
				from its boundary release page.
			</P>
			<Request
				url={`${API_BASE_URL}/areas?geography=ward&release=2024-12-uk-bgc&limit=100`}
			/>

			<H2 id="containment">What an area contains</H2>
			<P>
				To ask which wards are in Manchester, list the council&apos;s
				children. `childGeography` picks the kind of area, and without
				it you get the newest release of each geography that was current
				alongside the council&apos;s.
			</P>
			<Request
				url={`${API_BASE_URL}/areas/localAuthority/latest/E08000003/children?childGeography=ward`}
			/>
			<P>
				Parents work the other way. A ward&apos;s parents include its
				council and the constituencies it falls inside, and `depth`
				follows the chain further up.
			</P>
			<Request
				url={`${API_BASE_URL}/areas/ward/latest/E05011350/parents`}
			/>
			<P>
				Both only list areas that fit wholly inside one another, as
				their publishers declare. Where areas only partly overlap, such
				as wards that straddle a constituency boundary, use a
				[crosswalk](/docs/v1/concepts/crosswalks) instead.
			</P>

			<H2 id="history">When areas change</H2>
			<P>
				Councils merge, wards are redrawn and constituencies are
				reshaped, so a code can stop appearing in newer releases. Ask
				for Allerdale (`E07000026`) in the `latest` release and you get
				`area_not_in_release`, with `presentIn` listing the releases
				that still hold it. Ask one of those for the code&apos;s history
				to find out what happened:
			</P>
			<Request
				url={`${API_BASE_URL}/areas/localAuthority/2022-12-uk-bgc-v2/E07000026/history`}
			/>
			<P>
				Allerdale&apos;s `successor` is Cumberland (`E06000063`), from
				April 2023, and Cumberland&apos;s own history lists the three
				councils it was `merged-from`. Each link names the published
				lookup it comes from:
			</P>
			<Table
				head={["Relation", "What it means"]}
				rows={[
					[
						"`successor`, `predecessor`",
						"The publisher's lookup says one area became another.",
					],
					[
						"`merged-from`, `split-from`",
						"The new area was made from several old ones, or is one part of an old area.",
					],
					[
						"`equivalent-to`",
						"The same extent in the neighbouring release, so nothing changed between them.",
					],
				]}
			/>
			<P>
				`sameCodeReleases` lists every release that uses the same code.
				That alone doesn&apos;t mean the boundary stayed the same, since
				publishers sometimes redraw an area and keep its code.
			</P>
			<Callout tone="note">
				{`The archive starts at different years for each geography: ${since}. Each [geography page](/docs/v1/geographies) lists exactly which releases it has. Earlier boundaries aren't in the Atlas yet.`}
			</Callout>

			<H2 id="data">Which areas data is on</H2>
			<P>
				Publishers release statistics against the area codes that were
				current when they made them. When you ask for data, you name
				that set of codes with two parameters:
			</P>
			<List
				items={[
					"`geography`: the kind of area the publisher used, such as `ward`.",
					"`codeYear`: the year of the codes they used, such as `2023`.",
				]}
			/>
			<P>
				This doesn't choose which boundaries to draw. To put values on a
				map, add a `release`. The API only accepts one that contains
				every area code in the data, so nothing silently goes missing. A
				release that doesn't fit is refused with
				`incompatible_geometry`, naming the releases that would, and a
				measure's [evidence
				document](/docs/v1/reference/governance/evidence-document) lists
				every compatible release.
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
			<EndpointRef id="getBoundaryRelease" />
			<EndpointRef id="listAreas" />
			<EndpointRef id="getArea" />
			<EndpointRef id="getAreaChildren" />
			<EndpointRef id="getAreaParents" />
			<EndpointRef id="getAreaHistory" />
			<EndpointRef id="validateAreaValues" />
			<EndpointRef id="getAreaGeometry" />
		</DocPage>
	);
}
