import {
	Callout,
	DocPage,
	EndpointRef,
	H2,
	P,
	Step,
	Steps,
} from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Explore a named place",
	"A practical guide to finding information about broad places such as North Wales or Greater Manchester with the UK Data Atlas API.",
	"/docs/v1/guides/named-place",
);

const API = API_BASE_URL;

export default function NamedPlaceGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/named-place"
			eyebrow="Guide"
			title="Explore a named place"
			lede="People ask about places that official boundary systems do not always name: North Wales, Greater Manchester, the Highlands or the Belfast Metropolitan Area. Treat the name as a curated collection, inspect what it contains, then choose how to calculate an answer."
			toc={[
				{ id: "search", title: "Search the name" },
				{ id: "inspect", title: "Inspect the definition" },
				{ id: "members", title: "Resolve its members" },
				{ id: "answer", title: "Ask a question" },
				{ id: "explain", title: "Explain the result" },
				{ id: "definitions", title: "When the definition matters" },
			]}
		>
			<Steps>
				<Step id="search" title="Search the name">
					<P>
						Start with the words a person uses. Search is
						deliberately ambiguous-friendly: it returns the curated
						id rather than asking you to guess a URL slug.
					</P>
					<Request
						url={`${API}/locations?q=North%20Wales`}
						operationId="listNamedLocations"
					/>
				</Step>

				<Step id="inspect" title="Inspect the definition">
					<P>
						Use the returned id, `north-wales`, to read the
						definition and its member geography. This is an
						editorial grouping, not a new official boundary, so the
						response keeps the definition revision and member codes
						visible.
					</P>
					<Request
						url={`${API}/locations/north-wales`}
						operationId="getNamedLocation"
					/>
					<Request
						url={`${API}/locations/north-wales?include=capabilities`}
						operationId="getNamedLocation"
					/>
				</Step>

				<Step id="members" title="Resolve its members">
					<P>
						Choose the boundary release you want to work in. For
						direct members, use the location's declared geography;
						for another geography, name a published crosswalk with
						`via`. The API returns unresolved codes and coverage
						instead of silently dropping them.
					</P>
					<Request
						url={`${API}/locations/north-wales/members?release=2025-12-uk-bgc`}
						operationId="getNamedLocationMembers"
					/>
					<Request
						url={`${API}/locations/north-wales/members?geography=ward&release=2024-12-uk-bgc&via=ward-2024-12-uk-bgc-to-local-authority-2024-12-uk-bgc-clean-containment`}
						operationId="getNamedLocationMembers"
					/>
				</Step>

				<Step id="answer" title="Ask a question">
					<P>
						For an additive measure such as population, ask for a
						total over the named location. The route records the
						source partition and the coverage used to produce it.
					</P>
					<Request
						url={`${API}/data/population/value?period=2024&geography=localAuthority&codeYear=2023&place=location/north-wales`}
						operationId="getMeasureValueForPlace"
					/>
					<Callout tone="warning">
						Not every measure can be added. A median, rank or
						percentage may need a different question, and the API
						will explain the refusal rather than produce a
						misleading total.
					</Callout>
				</Step>

				<Step id="explain" title="Explain the result">
					<P>
						Show the location label, definition revision, source
						geography, boundary release and coverage alongside the
						number. If you used a crosswalk, keep its id too: “North
						Wales” can mean different things depending on which
						published membership relationship you chose.
					</P>
					<Request
						url={`${API}/locations/north-wales/parents?geography=region&release=2025-12-en-bgc&via=local-authority-2025-12-uk-bgc-to-region-2025-12-en-bgc-area-overlap`}
						operationId="getNamedLocationParents"
					/>
				</Step>
			</Steps>

			<H2 id="definitions">When the definition matters</H2>
			<P>
				One name can have several curated definitions, such as a
				ceremonial and a historic county of the same name. Give the
				exact name to see each one, its kind and the source that sets it
				apart:
			</P>
			<Request url={`${API}/locations/alternatives?q=Lancashire`} />
			<P>
				Members change as councils are reorganised. Compare a location's
				membership between two dates to see which councils it kept,
				gained or lost, before you put figures from different years side
				by side:
			</P>
			<Request
				url={`${API}/locations/lancashire/comparison?from=1974&to=2026-01-01`}
				operationId="compareNamedLocationMembership"
			/>
			<P>
				For a map, fetch the location's outline as one GeoJSON feature,
				its members merged into a single shape:
			</P>
			<Request
				url={`${API}/locations/greater-manchester/geometry`}
				operationId="getNamedLocationGeometry"
			/>

			<P>
				Named locations are useful starting points, not permission to
				hide the method. When the exact boundary matters, move from the
				named location to its official members and keep the release and
				crosswalk in your records.
			</P>
			<EndpointRef id="listNamedLocations" />
			<EndpointRef id="getNamedLocationMembers" />
			<EndpointRef id="getMeasureValueForPlace" />
			<EndpointRef id="getNamedLocationAlternatives" />
			<EndpointRef id="compareNamedLocationMembership" />
		</DocPage>
	);
}
