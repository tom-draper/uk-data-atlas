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
	"/docs/concepts/places",
);

export default function PlacesPage() {
	return (
		<DocPage
			href="/docs/concepts/places"
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
				Some places people care about aren't official areas at all, like
				"North Wales" or "Greater Manchester". Named locations fill that
				gap: groupings of local authorities, curated by the Atlas.
			</P>
			<P>
				They're a convenience, not an official geography, and the API
				says so. You can add up data over them, and list the wards or
				constituencies inside them through a
				[crosswalk](/docs/concepts/crosswalks).
			</P>

			<H2 id="endpoints">Useful endpoints</H2>
			<EndpointRef id="resolvePlaces" />
			<EndpointRef id="listNamedLocations" />
			<EndpointRef id="getNamedLocationMembers" />
		</DocPage>
	);
}
