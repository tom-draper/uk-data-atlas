import {
	Callout,
	DocPage,
	EndpointRef,
	H2,
	P,
	Table,
} from "@/components/docs/Content";
import { docsMetadata } from "@/lib/docs/metadata";

export const metadata = docsMetadata(
	"Measures and periods",
	"What a measure is in the UK Data Atlas API, which measures can be added up or averaged, and how periods are named.",
	"/docs/v1/concepts/measures",
);

export default function MeasuresPage() {
	return (
		<DocPage
			href="/docs/v1/concepts/measures"
			eyebrow="Concepts"
			title="Measures and periods"
			lede="A measure is one thing that's counted or measured about an area, such as its population, median pay or broadband coverage. Every number the API gives you belongs to a measure and a period."
			toc={[
				{ id: "measures", title: "What a measure is" },
				{ id: "combining", title: "Can it be added up?" },
				{ id: "periods", title: "Periods" },
				{ id: "uncertainty", title: "Uncertainty" },
				{ id: "endpoints", title: "Useful endpoints" },
			]}
		>
			<H2 id="measures">What a measure is</H2>
			<P>
				Each measure has an `id` you use in requests, like
				`population-estimate`, `claimant-count` or
				`no2-background-mean`, plus a `label`, a `unit` and a note of
				which areas and years it covers. Many come from the Office for
				National Statistics; others come from bodies like Ofcom and
				Defra.
			</P>
			<P>
				A measure is published as it was released. If a publisher only
				covers England and Wales, so does the measure, and the API won't
				fill in the gaps.
			</P>

			<H2 id="combining">Can it be added up?</H2>
			<P>
				Not every number can be combined. You can add up the populations
				of two councils, but you can't add up their median pay. Each
				measure declares which kind it is in its `aggregation`, and the
				API only offers totals, averages and conversions that make
				sense.
			</P>
			<Table
				head={["Kind", "What it is", "Examples", "What you can do"]}
				rows={[
					[
						"`extensive`",
						"Counts of things",
						"Population, jobs, claimants",
						"Add up over areas, and convert to other areas",
					],
					[
						"`intensive`",
						"Shares, rates and averages",
						"Broadband availability, air pollution",
						"Average over areas, but only with the published weight the measure names",
					],
					[
						"`non-aggregatable`",
						"Medians, ranks and similar",
						"House prices, deprivation deciles, life expectancy",
						"Use each area's value as it is",
					],
				]}
			/>
			<Callout tone="tip">
				Asking for something that doesn't make sense, like the total of
				a median, gets a clear `422` explaining why. See
				[Errors](/docs/v1/errors).
			</Callout>
			<P>
				A few measures are calculated by the Atlas rather than published
				directly, like `population-density`. Their values are marked
				`derived`, and the measure lists the datasets it was calculated
				from.
			</P>

			<H2 id="periods">Periods</H2>
			<P>
				A period is the time a value describes, written the way the
				publisher writes it: `2022` for a year, `2026-04` for a month,
				or `year-ending-2026-03` for a rolling year. A measure's
				catalogue entry lists every period it has.
			</P>
			<P>
				Wherever `period` is optional, leaving it out gives you the
				latest one, and the response tells you it did.
			</P>

			<H2 id="uncertainty">Uncertainty</H2>
			<P>
				Some statistics are estimates with a margin of error. Where the
				publisher gives one, each value carries a `confidenceInterval`
				with its `lower` and `upper` bounds. The API never invents
				intervals of its own.
			</P>

			<H2 id="endpoints">Useful endpoints</H2>
			<EndpointRef id="listMeasures" />
			<EndpointRef id="getMeasure" />
			<EndpointRef id="getMeasureQuality" />
		</DocPage>
	);
}
