import {
	Callout,
	DocPage,
	EndpointRef,
	H2,
	P,
	Table,
} from "@/components/docs/Content";
import { SpecExample } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";

export const metadata = docsMetadata(
	"Places and named locations",
	"How the UK Data Atlas API turns place names into exact areas, and how named locations like Greater Manchester group areas together.",
	"/docs/v1/concepts/places",
);

export default function PlacesPage() {
	return (
		<DocPage
			href="/docs/v1/concepts/places"
			eyebrow="Concepts"
			title="Places and named locations"
			lede="People ask about places by name, but a name is rarely one area. The API helps you get from a name to exactly the areas you mean, without guessing on your behalf."
			toc={[
				{ id: "names", title: "Names mean many things" },
				{ id: "matches", title: "How names match" },
				{ id: "references", title: "Place references" },
				{ id: "named-locations", title: "Named locations" },
				{ id: "endpoints", title: "Useful endpoints" },
			]}
		>
			<H2 id="names">Names mean many things</H2>
			<P>
				"Manchester" is a council, a major town, a travel to work area
				and a ward. "Newport" is thirteen different areas in Wales, the
				Isle of Wight and Shropshire. So when you search, you get every
				candidate, and you choose:
			</P>
			<SpecExample id="resolvePlaces" />

			<H2 id="matches">How names match</H2>
			<P>
				Searching ignores case, accents, punctuation and ampersands, and
				checks aliases such as Welsh names too. Each result says how it
				matched:
			</P>
			<Table
				head={["Match", "Meaning"]}
				rows={[
					["`exact`", "The name is exactly what was published."],
					[
						"`exact-without-title`",
						'The name matched once an official title was set aside, so "Bristol" finds "Bristol, City of".',
					],
					[
						"`prefix`",
						'The published name starts with your search, so "Richmond" also finds Richmond upon Thames.',
					],
				]}
			/>

			<H2 id="references">Place references</H2>
			<P>
				Each result has a `place` reference, such as
				`localAuthority/E06000023`. It pins down one place, so you can
				hand it back to the API without any ambiguity:
			</P>
			<SpecExample id="getMeasureValueForPlace" showResponse={false} />
			<Callout tone="tip">
				If a name you pass could mean places with different answers,
				you'll get a `409` listing the `choices`, each with the place
				reference to use.
			</Callout>

			<H2 id="named-locations">Named locations</H2>
			<P>
				Many places people care about aren't published as a geography,
				like "Kent", "Yorkshire" or "North Wales". Named locations fill
				that gap: each is a set of local authorities, and its `kind`
				says where that set comes from.
			</P>
			<Table
				head={["Kind", "Where its members come from", "Example"]}
				rows={[
					[
						"`country`, `region`, `combined-authority`, `county`",
						"An official Office for National Statistics lookup, named in its `source`.",
						"Greater Manchester",
					],
					[
						"`ceremonial-county`",
						"Ordnance Survey's ceremonial county boundaries. Each council is counted in the county holding most of its area.",
						"Kent, including Medway",
					],
					[
						"`historic-county`",
						"Ordnance Survey's historic counties of around 1888, matched to councils the same way.",
						"Middlesex",
					],
					[
						"`editorial-grouping`",
						"A set curated by the Atlas, which claims no official status.",
						"North Wales",
					],
				]}
			/>
			<P>
				Ceremonial and historic counties have no official code, and
				their edges follow council lines rather than the county&apos;s
				own. Scotland&apos;s lieutenancy areas don&apos;t follow council
				lines, so they aren&apos;t included. Members can change over
				time as councils are reorganised.
			</P>
			<P>
				You can add up data over any named location, and list the wards
				or constituencies inside it through a
				[crosswalk](/docs/v1/concepts/crosswalks).
			</P>

			<H2 id="endpoints">Useful endpoints</H2>
			<EndpointRef id="resolvePlaces" />
			<EndpointRef id="listNamedLocations" />
			<EndpointRef id="getNamedLocationMembers" />
		</DocPage>
	);
}
