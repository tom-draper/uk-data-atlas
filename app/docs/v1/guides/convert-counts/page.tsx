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
	"Convert your own counts",
	"A step-by-step guide to converting your own counts from one set of UK areas to another with the UK Data Atlas API, such as wards to councils or constituencies to councils, and knowing which results are exact and which are estimates.",
	"/docs/v1/guides/convert-counts",
);

const API = API_BASE_URL;
const WARDS =
	"ward-2026-05-uk-bgc-to-local-authority-2026-05-uk-bgc-clean-containment";
const SEATS =
	"constituency-2024-07-uk-bgc-to-local-authority-2024-05-uk-bgc-population-overlap";

const json = (rows: object[]) => ({
	contentType: "application/json",
	example: JSON.stringify({ rows }),
});

export default function ConvertCountsGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/convert-counts"
			eyebrow="Guide"
			title="Convert your own counts"
			lede="Your referrals are counted by ward, but each council wants its own total. Or your members are counted by constituency, and a funder asks for them by council. Send your counts and get them back on the areas you need, with a clear statement of what is exact and what is an estimate."
			toc={[
				{ id: "find", title: "Find the crosswalk" },
				{ id: "send", title: "Send your counts" },
				{ id: "read", title: "Read the result" },
				{ id: "split", title: "When areas split" },
				{ id: "refused", title: "When the request is refused" },
			]}
		>
			<Steps>
				<Step id="find" title="Find the crosswalk">
					<P>
						A crosswalk says which of your areas fall in which of
						the areas you want. Ask which ones join your release to
						the one you need. For wards counted on May 2026
						boundaries, totalled by council:
					</P>
					<Request
						url={`${API}/relationships?from=ward/2026-05-uk-bgc&to=localAuthority/2026-05-uk-bgc&purpose=membership`}
						operationId="queryRelationships"
					/>
					<P>
						Each path's `steps` name the `crosswalkId` to use. Not
						sure which release your codes are from? [Identify a
						column of codes](/docs/v1/guides/identify-codes) finds
						it.
					</P>
				</Step>

				<Step id="send" title="Send your counts">
					<P>
						POST one row per area, as a code or a name, with its
						count. Ward names repeat across the country, so add a
						`parent` to say which one you mean. There are a dozen
						wards called Abbey; this one is in Merton.
					</P>
					<Request
						url={`${API}/crosswalks/${WARDS}:convert?semantics=count`}
						operationId="convertSuppliedCounts"
						body={json([
							{ name: "Headingley & Hyde Park", value: 40 },
							{ name: "Rusholme", value: 25 },
							{ code: "E05010885", value: 18 },
							{ name: "Abbey", parent: "Merton", value: 12 },
						])}
					/>
					<P>
						`semantics=count` is you confirming the values are
						counts that add up across areas, such as people,
						referrals or visits. You can send up to 250,000 rows, as
						JSON or CSV, and nothing you send is stored.
					</P>
					<Callout tone="warning">
						Don't send rates, percentages, averages or medians.
						Adding them up gives a number that looks right and
						isn't.
					</Callout>
				</Step>

				<Step id="read" title="Read the result">
					<P>
						Each record is one council with its total in `value`.
						`method` is `exact` here, because every ward sits wholly
						inside one council, and `inputTotal` matches
						`outputTotal`.
					</P>
					<P>
						Check each record's `coverage`. `partial` means you sent
						some of the council's wards but not all, so its total
						only covers the wards you sent. A council you sent
						nothing for is left out rather than given a zero.
					</P>
				</Step>

				<Step id="split" title="When areas split">
					<P>
						Constituencies cross council boundaries, so a count for
						one seat has to be shared between councils. This
						crosswalk shares it by where people lived at the 2021
						census, and you opt in with `weighting=population`:
					</P>
					<Request
						url={`${API}/crosswalks/${SEATS}:convert?semantics=count&weighting=population`}
						body={json([
							{ code: "E14001319", value: 120 },
							{ code: "E14001172", value: 80 },
						])}
					/>
					<P>
						Leeds Central and Headingley lies wholly in Leeds, so
						its 120 moves across unchanged. Cities of London and
						Westminster is split: about 6 of its 80 go to the City
						of London and 74 to Westminster, and `method` becomes
						`population-weighted`. Split values aren't rounded, so
						round them when you present them and call them
						estimates.
					</P>
					<Callout tone="note">
						Some crosswalks share by land area instead, with
						`weighting=area`. That assumes your count is spread
						evenly over the land, which is rarely true. Shared by
						area, the City of London gets about 12, twice as many,
						because it has a lot of land for very few residents.
						Prefer population weights for counts of people.
					</Callout>
				</Step>

				<Step id="refused" title="When the request is refused">
					<P>
						If any row can't be placed, nothing is converted. You
						get a `422` with `conversion_not_available`, and
						`rejected` lists each problem row with its `index` and
						`reason`. Without a parent, Abbey is `ambiguous`, and
						its `candidates` list every ward with that name:
					</P>
					<Request
						url={`${API}/crosswalks/${WARDS}:convert?semantics=count`}
						body={json([
							{ name: "Headingley & Hyde Park", value: 40 },
							{ name: "Abbey", value: 12 },
						])}
					/>
					<P>
						A split with no published weights is refused too, rather
						than guessed. That's why 2019 constituency results can't
						be moved onto the 2024 seats, as [Brief on a
						constituency](/docs/v1/guides/constituency) explains.
					</P>
				</Step>
			</Steps>

			<EndpointRef id="queryRelationships" />
			<EndpointRef id="convertSuppliedCounts" />
			<EndpointRef id="listCrosswalks" />
		</DocPage>
	);
}
