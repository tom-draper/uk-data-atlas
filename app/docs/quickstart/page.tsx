import type { Metadata } from "next";
import {
	Callout,
	CardGrid,
	DocPage,
	LinkCard,
	P,
	Step,
	Steps,
} from "@/components/docs/Content";
import { SpecExample } from "@/components/docs/Example";

const TITLE = "Quickstart - UK Data Atlas API";
const DESCRIPTION =
	"Make your first requests to the UK Data Atlas API in five minutes: search for a place, get a population figure, and fetch a time series.";

export const metadata: Metadata = {
	title: { absolute: TITLE },
	description: DESCRIPTION,
	alternates: { canonical: "/docs/quickstart" },
	openGraph: { title: TITLE, description: DESCRIPTION },
};

export default function QuickstartPage() {
	return (
		<DocPage
			href="/docs/quickstart"
			eyebrow="Get started"
			title="Quickstart"
			lede="Five requests that take you from a place name to real numbers. There's nothing to install and no key to set up: every request is a plain GET, so you can paste any of these URLs straight into your browser."
			toc={[
				{ id: "search", title: "Search for a place" },
				{ id: "answer", title: "Ask a question" },
				{ id: "measures", title: "See what's available" },
				{ id: "observations", title: "Get values for areas" },
				{ id: "series", title: "Follow an area over time" },
			]}
		>
			<Callout title="How responses look">
				Every successful response wraps its result in `data`, alongside
				`atlasRelease`, which identifies the exact version of the data
				you got. [Responses](/docs/responses) explains the rest.
			</Callout>

			<Steps>
				<Step id="search" title="Search for a place">
					<P>
						Most questions start with a place. Search for one by
						name to see which official areas it could mean:
					</P>
					<SpecExample id="resolvePlaces" />
					<P>
						"Bristol" is both a council and a major town, so you get
						both. Each has a `code` (like `E06000023`), its
						`geography` (the kind of area) and a `place` reference
						you can use in later requests.
					</P>
				</Step>

				<Step id="answer" title="Ask a question">
					<P>
						For a quick answer, give a measure and a place. Here's
						the population of the North West in 2022:
					</P>
					<SpecExample id="getMeasureValueForPlace" />
					<P>
						The `answer` holds the number. `via` shows the exact
						request that produced it, so you can always see how it
						was worked out.
					</P>
				</Step>

				<Step id="measures" title="See what's available">
					<P>
						A measure is something that's counted or measured, like
						`population-estimate` or `median-annual-pay`. List them
						all to see their units, coverage and whether they can be
						added up:
					</P>
					<SpecExample id="listMeasures" showResponse={false} />
				</Step>

				<Step id="observations" title="Get values for areas">
					<P>
						To fetch data yourself, ask for a measure, a `period`
						and the set of areas it was published on. That set is
						named by `geography` and `boundaryYear`: here, wards as
						they were coded in 2023.
					</P>
					<SpecExample id="getMeasureObservations" />
					<P>
						Leave out `areaCode` to get every ward, a page at a
						time. [Pagination](/docs/pagination) shows how to fetch
						the rest.
					</P>
				</Step>

				<Step id="series" title="Follow an area over time">
					<P>
						Ask for one area's series to get every period at once,
						ready for a chart. This is Birmingham:
					</P>
					<SpecExample id="getSourceExactMeasureSeries" />
				</Step>
			</Steps>

			<P>That's the core of it. From here:</P>
			<CardGrid>
				<LinkCard
					href="/docs/concepts/measures"
					title="Learn the concepts"
				>
					What measures, geographies and boundary releases are, and
					why they matter.
				</LinkCard>
				<LinkCard href="/docs/guides/map" title="Draw a map">
					Put values on boundaries that are guaranteed to match.
				</LinkCard>
			</CardGrid>
		</DocPage>
	);
}
