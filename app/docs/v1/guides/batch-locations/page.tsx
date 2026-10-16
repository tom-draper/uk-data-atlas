import {
	Callout,
	DocPage,
	EndpointRef,
	H2,
	P,
	Step,
	Steps,
} from "@/components/docs/Content";
import { SpecExample } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";

export const metadata = docsMetadata(
	"Locate a batch of points",
	"A practical guide to matching a spreadsheet of coordinates to UK areas with explicit coverage and uncertainty results.",
	"/docs/v1/guides/batch-locations",
);

export default function BatchLocationsGuidePage() {
	return (
		<DocPage
			href="/docs/v1/guides/batch-locations"
			eyebrow="Guide"
			title="Locate a batch of points"
			lede="Have a spreadsheet of sites, incidents or survey points? Send up to 100 coordinates or postcodes in one request, match each to its containing area, and keep the ones the API could not place instead of losing them in a failed join."
			toc={[
				{ id: "send", title: "Send the points" },
				{ id: "read", title: "Read every result" },
				{ id: "follow", title: "Join your data" },
				{ id: "postcodes", title: "Postcodes instead of points" },
			]}
		>
			<Steps>
				<Step id="send" title="Send the points">
					<P>
						{
							"POST the coordinates as a JSON `points` array, each one `{lng},{lat}`. This example sends a point in Leeds and another outside UK coverage, asking for local authorities as they were published on 1 June 2025."
						}
					</P>
					<SpecExample id="findContainingAreasForPoints" />
				</Step>

				<Step id="read" title="Read every result">
					<P>
						Use `points[].index` to join the answer back to your
						input row. A matched point has an area id and code; an
						`outside-coverage` point is still a successful response,
						with an explanation and no invented area.
					</P>
					<Callout tone="tip">
						Keep `summary.outsideCoverage`, `summary.unresolved` and
						`nearBoundary` in your import report. They tell you how
						much of your input needs review.
					</Callout>
				</Step>

				<Step id="follow" title="Join your data">
					<P>
						For matched rows, store the complete area `id`, not only
						its code. The id preserves the geography and boundary
						release, so a later data request uses the same area
						vintage as the lookup.
					</P>
					<P>
						You can then request a measure for the matched codes, or
						keep the point-to-area table as a reusable spatial join.
						The batch endpoint is capped at 100 points; page your
						own input into bounded batches.
					</P>
				</Step>
			</Steps>

			<H2 id="postcodes">Postcodes instead of points</H2>
			<P>
				A list of addresses usually has postcodes rather than
				coordinates. Send up to 100 full postcodes as a JSON `postcodes`
				array, and each is placed by its centroid from the ONS Postcode
				Directory, in its local authority, ward and Westminster
				constituency unless you ask for other geographies:
			</P>
			<SpecExample id="resolvePostcodes" showResponse={false} />
			<P>
				Each postcode keeps its place in the order you sent, with a
				`status`. A postcode that is `invalid`, `not-found`, has no grid
				reference (`not-placed`) or is in Northern Ireland
				(`not-served`) doesn't fail the batch, and `summary` counts each
				outcome for your import report. Add `view=compact` if you only
				need each postcode's point and areas.
			</P>

			<EndpointRef id="findContainingAreasForPoints" />
			<EndpointRef id="resolvePostcodes" />
			<EndpointRef id="getMeasureObservations" />
		</DocPage>
	);
}
