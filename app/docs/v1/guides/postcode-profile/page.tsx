import {
	Callout,
	DocPage,
	EndpointRef,
	P,
	Step,
	Steps,
	Table,
} from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Profile a postcode",
	"A step-by-step guide to building an area profile from a UK postcode with the UK Data Atlas API: deprivation, council tax, broadband and crime, each labelled with the area it describes.",
	"/docs/v1/guides/postcode-profile",
);

const API = API_BASE_URL;
const POSTCODE = "LS6%203AA";

const MEASURES: [string, string][] = [
	["`imd-decile`", "The neighbourhood (LSOA), about 1,500 people"],
	["`population`", "The ward"],
	["`council-tax`", "The council"],
	["`broadband-full-fibre-availability`", "The council"],
	["`median-annual-pay`", "The council"],
	["`crime-total`", "The community safety partnership, usually the council"],
];

export default function PostcodeProfileGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/postcode-profile"
			eyebrow="Guide"
			title="Profile a postcode"
			lede="Building a property listing, a house-hunting tool or a local news page? Turn a postcode into a short profile of the area around it, with each figure taken from the right geography and labelled with the area it describes."
			toc={[
				{ id: "lookup", title: "Look up the postcode" },
				{ id: "ask", title: "Ask each measure" },
				{ id: "label", title: "Say how local each figure is" },
				{ id: "coverage", title: "Handle gaps in coverage" },
				{ id: "credit", title: "Credit the sources" },
			]}
		>
			<Steps>
				<Step id="lookup" title="Look up the postcode">
					<P>
						Start by checking the postcode is real and finding the
						areas it sits in. The answer lists its council, ward and
						Westminster constituency, with the boundary release each
						was matched in.
					</P>
					<Request
						url={`${API}/postcodes/${POSTCODE}`}
						operationId="resolvePostcode"
					/>
					<Callout tone="tip">
						Check `status`. A `terminated` postcode still resolves,
						because old addresses still turn up in real data, so
						decide whether your users should see it.
					</Callout>
				</Step>

				<Step id="ask" title="Ask each measure">
					<P>
						Each measure is published for its own kind of area.
						Deprivation is ranked for small neighbourhoods, council
						tax is set by councils and crime is counted by community
						safety partnerships. You don't need to work out which
						area to ask about. Pass the postcode as `place` and the
						API finds the area of the right kind:
					</P>
					<Request
						url={`${API}/data/imd-decile/value?place=${POSTCODE}`}
						operationId="getMeasureValueForPlace"
					/>
					<P>
						The figure is in `answer.value`, with its `unit`. Ask
						the same way for each measure in your profile. These
						answer for these areas:
					</P>
					<Table head={["Measure", "Answered for"]} rows={MEASURES} />
					<Request
						url={`${API}/data/council-tax/value?place=${POSTCODE}`}
					/>
					<Callout tone="note">
						Leave out `period` and you get the latest one.
						`answer.periodDefaulted` is `true` when the period was
						chosen for you, so always show `answer.period` beside
						the figure.
					</Callout>
				</Step>

				<Step id="label" title="Say how local each figure is">
					<P>
						Every answer has an `area` naming what the figure
						describes. Show it. A deprivation decile describes a few
						streets, but the crime count for this postcode is every
						offence recorded across Leeds, which is not the same as
						the crime on its street.
					</P>
					<P>
						A postcode is placed by a single point, its centroid.
						When that point is close to an area's edge,
						`area.nearBoundary` is `true` and `distanceToBoundaryM`
						says how close. LS6 3AA is about 16 metres from the edge
						of its neighbourhood, so some of its addresses may fall
						in the next one. Treat neighbourhood figures for such
						postcodes as approximate.
					</P>
				</Step>

				<Step id="coverage" title="Handle gaps in coverage">
					<P>
						Not every measure covers the whole UK. The Index of
						Multiple Deprivation is England's, so a Cardiff postcode
						is refused with `place_not_served`, and each entry in
						`candidates` says why:
					</P>
					<Request
						url={`${API}/data/imd-decile/value?place=CF10%201AA`}
					/>
					<P>
						Each nation publishes its own index, and they can't be
						compared with each other. Use `wimd-decile` in Wales,
						`simd-decile` in Scotland and `nimdm-rank` in Northern
						Ireland, and label which one you show. A refused measure
						should leave a gap in your profile, not a zero.
					</P>
					<Callout tone="warning">
						Northern Ireland postcodes can't be looked up at all.
						Land and Property Services license them for internal
						business use only, so they are refused with `451`.
					</Callout>
				</Step>

				<Step id="credit" title="Credit the sources">
					<P>
						Publishing the profile? Ask for the attribution for the
						measures you show. `text` is ready to print under the
						profile, and `licences` lists the licence terms.
					</P>
					<Request
						url={`${API}/attribution?measure=imd-decile&measure=council-tax&measure=broadband-full-fibre-availability&measure=crime-total`}
						operationId="getAttribution"
					/>
				</Step>
			</Steps>

			<EndpointRef id="resolvePostcode" />
			<EndpointRef id="getMeasureValueForPlace" />
			<EndpointRef id="getAttribution" />
		</DocPage>
	);
}
