import {
	Callout,
	DocPage,
	EndpointRef,
	P,
	Step,
	Steps,
} from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Brief on a constituency",
	"A step-by-step guide to briefing on a Westminster constituency with the UK Data Atlas API: the 2024 result, turnout in context, population, and why 2019 results don't carry over to the new seats.",
	"/docs/v1/guides/constituency",
);

const API = API_BASE_URL;
const SEAT = "E14001319";
const PARTITION = "period=2024&geography=constituency&codeYear=2024";

export default function ConstituencyGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/constituency"
			eyebrow="Guide"
			title="Brief on a constituency"
			lede="Writing about a seat, briefing a candidate or building a page for constituents? Go from a postcode to the 2024 result, put turnout in context and describe who lives there, without comparing against 2019 as if the boundaries hadn't changed."
			toc={[
				{ id: "find", title: "Find the constituency" },
				{ id: "result", title: "Get the 2024 result" },
				{ id: "context", title: "Put turnout in context" },
				{ id: "people", title: "Describe who lives there" },
				{ id: "2019", title: "Be careful with 2019" },
				{ id: "credit", title: "Credit the sources" },
			]}
		>
			<Steps>
				<Step id="find" title="Find the constituency">
					<P>
						Most people know their postcode, not their constituency.
						Look it up, and take the `constituency` result. LS6 3AA
						is in Leeds Central and Headingley, `E14001319`, in the
						`2024-07-uk-bgc` release: the seats first contested in
						July 2024.
					</P>
					<Request
						url={`${API}/postcodes/LS6%203AA`}
						operationId="resolvePostcode"
					/>
					<Callout tone="tip">
						Matching a mailing list or petition to seats? [Locate a
						batch of points](/docs/v1/guides/batch-locations) sends
						up to 100 postcodes at a time.
					</Callout>
				</Step>

				<Step id="result" title="Get the 2024 result">
					<P>
						The winner is a category rather than a number, so it
						comes back as `category`, here `LAB`:
					</P>
					<Request
						url={`${API}/data/general-election-winning-party?${PARTITION}&place=${SEAT}`}
						operationId="getMeasureObservations"
					/>
					<P>
						Votes and vote shares are one measure per party. Search
						the catalogue to list them, then ask for the ones you
						need:
					</P>
					<Request url={`${API}/measures?q=vote%20share`} />
					<Request
						url={`${API}/data/general-election-lab-vote-share?${PARTITION}&place=${SEAT}`}
					/>
				</Step>

				<Step id="context" title="Put turnout in context">
					<P>
						A turnout of 45% means more next to every other seat.
						Rank all of them, lowest first, to see where this one
						falls:
					</P>
					<Request
						url={`${API}/data/general-election-turnout/rankings?${PARTITION}&order=asc&limit=20`}
						operationId="getSourceExactMeasureRankings"
					/>
					<P>
						Or set it against one other seat. Turnout is a
						percentage, so the `difference` is in percentage points,
						not a percentage change:
					</P>
					<Request
						url={`${API}/data/general-election-turnout/compare?${PARTITION}&baselinePlace=${SEAT}&comparisonPlace=E14001172`}
						operationId="compareSourceExactMeasureAreas"
					/>
				</Step>

				<Step id="people" title="Describe who lives there">
					<P>
						ONS publishes population estimates for the new seats in
						England and Wales:
					</P>
					<Request
						url={`${API}/data/population?period=2022&geography=constituency&codeYear=2024&place=${SEAT}`}
					/>
					<P>
						Most other measures are published for councils, and
						seats don't line up with councils. Before you quote a
						council figure for a seat, check how much of the seat
						the council covers. [Compare an
						area](/docs/v1/guides/compare) shows how.
					</P>
				</Step>

				<Step id="2019" title="Be careful with 2019">
					<P>
						The 2024 seats have new boundaries, so there is no
						published 2019 result for Leeds Central and Headingley.
						The seat's history lists the four old seats it was made
						from:
					</P>
					<Request
						url={`${API}/areas/constituency/2024-07-uk-bgc/${SEAT}/history`}
						operationId="getAreaHistory"
					/>
					<P>
						You can't add those four results together, because each
						old seat only partly became this one. The official
						lookup doesn't say how the voters were split, so
						converting 2019 votes onto the new seats is refused with
						`conversion_not_available` rather than guessed:
					</P>
					<Request
						url={`${API}/data/general-election-lab-votes/convert?period=2019&geography=constituency&codeYear=2019&crosswalk=constituency-2010-to-2024-official-lookup-v2`}
					/>
					<Callout tone="warning">
						Talking about a "swing" from 2019 means comparing with
						notional 2019 results for the new seats. Those are
						estimates made by others, and the API doesn't serve
						them. If you quote one, say whose it is.
					</Callout>
				</Step>

				<Step id="credit" title="Credit the sources">
					<P>
						The election results are compiled by the House of
						Commons Library. Get the attribution for what you quote:
					</P>
					<Request
						url={`${API}/attribution?measure=general-election-turnout&measure=population`}
						operationId="getAttribution"
					/>
				</Step>
			</Steps>

			<EndpointRef id="getMeasureObservations" />
			<EndpointRef id="getSourceExactMeasureRankings" />
			<EndpointRef id="compareSourceExactMeasureAreas" />
			<EndpointRef id="getAreaHistory" />
		</DocPage>
	);
}
