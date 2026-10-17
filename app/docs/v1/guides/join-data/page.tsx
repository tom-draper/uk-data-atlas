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
	"Join your own data",
	"A guide to joining a spreadsheet of UK area codes or names to official boundaries with the UK Data Atlas API: check every row, fix the ones that don't match, and draw the result.",
	"/docs/v1/guides/join-data",
);

const API = API_BASE_URL;

const RELEASE = "ward/2024-12-uk-bgc";

export default function JoinDataGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/join-data"
			eyebrow="Guide"
			title="Join your own data"
			lede="Have a spreadsheet with a column of ward codes or council names? Joining it to boundaries usually fails quietly: a code from last year's boundaries or a name shared by two places leaves a hole in the map. This guide checks every row first, fixes the ones that don't match, then joins the rest."
			toc={[
				{ id: "check", title: "Check the column" },
				{ id: "read", title: "Read the results" },
				{ id: "fix", title: "Fix what didn't match" },
				{ id: "join", title: "Join the rows" },
				{ id: "draw", title: "Draw it" },
			]}
		>
			<Steps>
				<Step id="check" title="Check the column">
					<P>
						Send the column to the release you want to join to. A
						short column can go in the URL as repeated `value`
						parameters; POST anything longer, up to 250,000 values,
						as JSON or as CSV with a header naming the column
						`area`, `code`, `name` or `value`:
					</P>
					<Request
						url={`${API}/areas:validate?geography=ward&release=2024-12-uk-bgc`}
						body={{
							contentType: "application/json",
							example: JSON.stringify({
								values: ["E05000650", "Bristol Central"],
							}),
						}}
					/>
					<Callout tone="tip">
						Not sure which release your codes come from? Leave out
						`geography` and `release`, and the response names the
						likely one. [Identify a column of
						codes](/docs/v1/guides/identify-codes) walks through it.
					</Callout>
				</Step>
				<Step id="read" title="Read the results">
					<P>
						Each value comes back with a status, in the order you
						sent them. `summary.joinable` is `true` only when every
						value names exactly one area of the release.
					</P>
					<Table
						head={["Status", "What it means"]}
						rows={[
							["`valid`", "The release holds this code."],
							[
								"`superseded`, `not-yet-current`, `absent-from-release`",
								"The code is real, but this release doesn't hold it: only older releases do, only newer ones do, or releases on both sides do.",
							],
							[
								"`other-geography`",
								"The code belongs to a different kind of area, such as a council code in a ward column.",
							],
							[
								"`unknown`, `malformed-code`",
								"No release holds the code, or it isn't shaped like one.",
							],
							[
								"`matched`",
								"A name matched exactly, through an alias such as a Welsh name, or with a title like “City of” set aside. Names never match by prefix or similarity.",
							],
							[
								"`ambiguous`",
								"The name means more than one area, and they're all listed.",
							],
							[
								"`unmatched`",
								"The name isn't in this release. The result lists other releases where it is.",
							],
						]}
					/>
				</Step>
				<Step id="fix" title="Fix what didn't match">
					<P>
						A superseded code usually means the area was redrawn. An
						area's history shows what it replaced, what replaced it
						and which other releases use its code, so you can decide
						whether to update the code or convert your data. Here's
						Birmingham's:
					</P>
					<Request
						url={`${API}/areas/localAuthority/2023-05-uk-bgc-v2/E08000025/history`}
						operationId="getAreaHistory"
					/>
					<P>
						For an ambiguous name, add a `parent` alongside it, such
						as the council's code or name. It resolves only when
						exactly one candidate sits inside that parent.
					</P>
					<Callout tone="note">
						A code that kept its value across releases isn't proof
						the area kept its shape. History lists the releases that
						share a code, but only a published lookup says what
						replaced what.
					</Callout>
				</Step>
				<Step id="join" title="Join the rows">
					<P>
						Send each area with its value. Rows are read exactly as
						the check reads them, and the answer numbers each joined
						area with the `id` the release's tiles use. Nothing is
						stored on the server.
					</P>
					<Request
						url={`${API}/boundary-releases/${RELEASE}:join`}
						body={{
							contentType: "application/json",
							example: JSON.stringify({
								rows: [
									{ area: "E05000650", value: 12.5 },
									{ area: "Bristol Central", value: 8 },
								],
							}),
						}}
					/>
					<P>
						Rows that couldn't be joined are listed in `unjoined`
						with their reason. Two rows naming the same area are
						both left out as `duplicate-area`, since only you know
						which value was meant.
					</P>
				</Step>
				<Step id="draw" title="Draw it">
					<P>
						Set each value on the release's vector tiles by its
						`id`, as in [Draw a map](/docs/v1/guides/map#tiles). For
						a one-off map, add `format=geojson` to the join instead,
						and each joined area comes back with its shape and
						value.
					</P>
					<Request
						url={`${API}/map-resources/${RELEASE}/tiles.json`}
						operationId="getMapResourceTileJson"
					/>
				</Step>
			</Steps>
			<EndpointRef id="validateAreaValuesPosted" />
			<EndpointRef id="getAreaHistory" />
			<EndpointRef id="joinRowsToBoundaryRelease" />
		</DocPage>
	);
}
