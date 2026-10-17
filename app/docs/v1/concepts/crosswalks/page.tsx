import {
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
	"Crosswalks",
	"How the UK Data Atlas API maps one set of areas onto another: wards into councils, old constituencies into new ones, and overlapping areas.",
	"/docs/v1/concepts/crosswalks",
);

export default function CrosswalksPage() {
	return (
		<DocPage
			href="/docs/v1/concepts/crosswalks"
			eyebrow="Concepts"
			title="Crosswalks"
			lede="A crosswalk connects one set of areas to another: the wards inside a council, or the 2024 constituency that replaced a 2010 one. Whenever the API moves between geographies, it does it through a crosswalk you can see and name."
			toc={[
				{ id: "kinds", title: "Three kinds" },
				{ id: "uses", title: "What they're used for" },
				{ id: "analysis", title: "Converting for analysis" },
				{ id: "translate", title: "Translating a code" },
				{ id: "endpoints", title: "Useful endpoints" },
			]}
		>
			<H2 id="kinds">Three kinds</H2>
			<Table
				head={["Kind", "What it says", "Example"]}
				rows={[
					[
						"Clean containment",
						"Each area sits wholly inside exactly one larger area.",
						"Wards within local authorities",
					],
					[
						"Historical lookup",
						"Which new areas replaced which old ones, as published by the official source.",
						"2010 constituencies to 2024 constituencies",
					],
					[
						"Area overlap",
						"How much areas that don't nest overlap each other, with weights that add up to 1.",
						"Constituencies and local authorities",
					],
				]}
			/>
			<P>
				Every crosswalk is checked before it's published. Containment
				must give each area exactly one parent, and overlap weights must
				add up. [Get a
				crosswalk](/docs/v1/reference/geography/crosswalk) shows the
				results with its method and quality.
			</P>

			<H2 id="uses">What they're used for</H2>
			<List
				items={[
					"Finding an area's [parents](/docs/v1/reference/geography/area-parents) and [children](/docs/v1/reference/geography/area-children).",
					"[Translating a code](/docs/v1/reference/geography/translate-area-code) from one geography or year to another.",
					"[Converting data](/docs/v1/reference/trend/convert-source-exact-measure) onto different areas, such as ward counts up to councils.",
					"Listing the areas inside a [named location](/docs/v1/concepts/places#named-locations).",
				]}
			/>
			<P>
				The API never picks a crosswalk for you when it matters. When
				you convert data, you name the crosswalk, and the response
				repeats how it was made.
			</P>

			<H2 id="analysis">Converting for analysis</H2>
			<P>
				A crosswalk existing doesn't make every conversion through it
				sound. Moving collisions counted on LSOAs up to councils works,
				because each LSOA sits inside one council and collisions add up;
				adding ward medians up into a council median doesn't. The Atlas
				keeps a list of the measure, source and boundary combinations it
				has reviewed as safe to convert:
			</P>
			<Request
				url={`${API_BASE_URL}/analysis-geographies?measure=road-collisions`}
			/>
			<P>
				Before fetching anything, ask for a plan. It names the source
				figures, the crosswalk and whether the period can be compared on
				the boundaries you want, and always offers the publisher's own
				figures as a safer alternative. It fetches and changes no data:
			</P>
			<Request
				url={`${API_BASE_URL}/analysis:plan?measure=road-collisions&period=2025&geography=lsoa&codeYear=2021&to=localAuthority/2023-05-uk-bgc-v2`}
			/>
			<P>
				A reviewed conversion can then be used with `analysisGeography`
				on [Get a time
				series](/docs/v1/reference/trend/source-exact-measure-series),
				or through [Convert to other
				areas](/docs/v1/reference/trend/convert-source-exact-measure). A
				combination that hasn't been reviewed is reported as
				`not-comparable`, never quietly substituted.
			</P>
			<P>
				Not sure which conversions exist? Ask what's published from one
				exact release. Add a `to` release and a `purpose` to compare the
				paths between them, with their coverage and what each may be
				used for:
			</P>
			<Request
				url={`${API_BASE_URL}/relationships?from=ward/2023-12-uk-bgc&to=localAuthority/2023-12-uk-bgc&purpose=membership`}
			/>

			<H2 id="translate">Translating a code</H2>
			<P>
				Here's a ward translated into the local authority it belongs to.
				`purpose=membership` asks for containment:
			</P>
			<SpecExample id="translateAreaCode" />

			<H2 id="endpoints">Useful endpoints</H2>
			<EndpointRef id="listCrosswalks" />
			<EndpointRef id="translateAreaCode" />
			<EndpointRef id="getAreaRelationships" />
			<EndpointRef id="queryRelationships" />
			<EndpointRef id="listAnalysisGeographies" />
			<EndpointRef id="planAnalysis" />
		</DocPage>
	);
}
