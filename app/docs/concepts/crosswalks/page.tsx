import {
	DocPage,
	EndpointRef,
	H2,
	List,
	P,
	Table,
} from "@/components/docs/Content";
import { SpecExample } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";

export const metadata = docsMetadata(
	"Crosswalks",
	"How the UK Data Atlas API maps one set of areas onto another: wards into councils, old constituencies into new ones, and overlapping areas.",
	"/docs/concepts/crosswalks",
);

export default function CrosswalksPage() {
	return (
		<DocPage
			href="/docs/concepts/crosswalks"
			eyebrow="Concepts"
			title="Crosswalks"
			lede="A crosswalk connects one set of areas to another: the wards inside a council, or the 2024 constituency that replaced a 2010 one. Whenever the API moves between geographies, it does it through a crosswalk you can see and name."
			toc={[
				{ id: "kinds", title: "Three kinds" },
				{ id: "uses", title: "What they're used for" },
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
				add up. [Get checks for a
				crosswalk](/docs/reference/governance/crosswalk-validation)
				shows the results.
			</P>

			<H2 id="uses">What they're used for</H2>
			<List
				items={[
					"Finding an area's [parents](/docs/reference/geography/area-parents) and [children](/docs/reference/geography/area-children).",
					"[Translating a code](/docs/reference/geography/translate-area-code) from one geography or year to another.",
					"[Converting data](/docs/reference/trend/convert-source-exact-measure) onto different areas, such as ward counts up to councils.",
					"Listing the areas inside a [named location](/docs/concepts/places#named-locations).",
				]}
			/>
			<P>
				The API never picks a crosswalk for you when it matters. When
				you convert data, you name the crosswalk, and the response
				repeats how it was made.
			</P>

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
		</DocPage>
	);
}
