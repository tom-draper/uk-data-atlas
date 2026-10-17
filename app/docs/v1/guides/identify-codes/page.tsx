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
	"Identify a column of codes",
	"A guide to finding which UK geography and boundary release a column of area codes belongs to with the UK Data Atlas API, and what to do when it mixes releases.",
	"/docs/v1/guides/identify-codes",
);

const API = API_BASE_URL;

export default function IdentifyCodesGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/identify-codes"
			eyebrow="Guide"
			title="Identify a column of codes"
			lede="Got a spreadsheet of area codes and no note of where they came from? Before you can map or join it, you need to know which kind of area they are and which year's boundaries they use. This guide asks the API to work that out."
			toc={[
				{ id: "send", title: "Send the column" },
				{ id: "likely", title: "Read the likely release" },
				{ id: "ties", title: "Choose between ties" },
				{ id: "mixed", title: "Handle a mixed column" },
			]}
		>
			<Steps>
				<Step id="send" title="Send the column">
					<P>
						Send the codes without a `geography` or `release`. POST
						them as JSON or CSV, up to 250,000 values, or put a
						short column in the URL as repeated `value` parameters.
						Here are four council codes and one newer one:
					</P>
					<Request
						url={`${API}/areas:validate`}
						body={{
							contentType: "application/json",
							example: JSON.stringify({
								values: [
									"E07000026",
									"E07000028",
									"E07000029",
									"E08000025",
									"E06000063",
								],
							}),
						}}
					/>
				</Step>
				<Step id="likely" title="Read the likely release">
					<P>
						The API checks the column against every compiled release
						and ranks them by how many values each holds exactly.
						`likely` names the best, here `localAuthority` release
						`2022-12-uk-bgc-v2`, and `candidates` lists the top ten
						with a count of statuses for each.
					</P>
					<P>
						`verdict` sums up whether you can use the column as it
						is:
					</P>
					<Table
						head={["Verdict", "What it means"]}
						rows={[
							[
								"`joinable`",
								"Every value names exactly one area of the likely release.",
							],
							[
								"`mixed-code-systems`",
								"The codes are real, but no single release holds them all.",
							],
							[
								"`incomplete`",
								"Some values are unknown, malformed or ambiguous.",
							],
							[
								"`unmatched`",
								"No release holds any of the values.",
							],
						]}
					/>
				</Step>
				<Step id="ties" title="Choose between ties">
					<P>
						Many codes stay the same for years, so several releases
						can hold a column equally well. When that happens,
						`likely` is the newest of them and `likely.tiedWith`
						lists the rest. The codes alone can&apos;t tell them
						apart, so pick by the date your data describes. [Find
						boundaries for a
						date](/docs/v1/reference/geography/resolve-boundary-release-for-date)
						names the release that was current then:
					</P>
					<Request
						url={`${API}/boundary-releases:resolve?geography=localAuthority&date=2021-06-30`}
					/>
				</Step>
				<Step id="mixed" title="Handle a mixed column">
					<P>
						In the example, `E06000063` is Cumberland, a council
						created in April 2023 from Allerdale, Copeland and
						Carlisle, which are also in the column. No release holds
						both, so the verdict is `mixed-code-systems`. The newer
						code&apos;s status is `not-yet-current`, and its
						`presentIn` lists the releases that do hold it.
					</P>
					<P>
						`recommendations` lists published lookups between the
						releases involved, with their quality. Use one to
						convert the stray codes, or drop them, then [join the
						column](/docs/v1/guides/join-data) to the release.
					</P>
					<Callout tone="note">
						The check never converts or joins anything for you. It
						reports what it found and leaves the choice to you.
					</Callout>
				</Step>
			</Steps>
			<EndpointRef id="validateAreaValuesPosted" />
			<EndpointRef id="resolveBoundaryReleaseForDate" />
		</DocPage>
	);
}
