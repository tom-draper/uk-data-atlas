import { Callout, DocPage, P, Step, Steps } from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import { docsMetadata } from "@/lib/docs/metadata";
import { API_BASE_URL } from "@/lib/docs/openapi";

export const metadata = docsMetadata(
	"Chart a trend",
	"A step-by-step guide to charting change over time with the UK Data Atlas API: read a measure, fetch a time series, rank change and quote the caveats.",
	"/docs/guides/trend",
);

const API = API_BASE_URL;

export default function TrendGuidePage() {
	return (
		<DocPage
			href="/docs/guides/trend"
			eyebrow="Guide"
			title="Chart a trend"
			lede="How has Birmingham's population changed, and how does that compare with everywhere else? This guide builds a trend you can stand behind, including the moments the API stops you making a mistake."
			toc={[
				{ id: "measure", title: "Read the measure" },
				{ id: "series", title: "Get the series" },
				{ id: "rank", title: "Put it in context" },
				{ id: "refusal", title: "Know what not to do" },
				{ id: "caveats", title: "Quote the caveats" },
			]}
		>
			<Steps>
				<Step id="measure" title="Read the measure">
					<P>
						Start by reading what the measure says about itself: its
						unit, whether it adds up, and which periods each of its
						sources covers. Here we'll use the local authority
						source on 2023 codes.
					</P>
					<Request url={`${API}/measures/population-estimate`} />
				</Step>

				<Step id="series" title="Get the series">
					<P>
						Fetch every period for one area, oldest first, ready to
						plot. Each point in `data.series` has a `period` and a
						`value`.
					</P>
					<Request
						url={`${API}/data/population-estimate/series?areaCode=E08000025&geography=localAuthority&boundaryYear=2023`}
					/>
				</Step>

				<Step id="rank" title="Put it in context">
					<P>
						A number on its own doesn't say much. Ask how
						Birmingham's growth from 2011 to 2022 ranks against
						every other local authority. The record gives its
						`relativeChange` and `rank`, and `coverage.areasRanked`
						says how many areas it was ranked against.
					</P>
					<Request
						url={`${API}/data/population-estimate/change?geography=localAuthority&boundaryYear=2023&startPeriod=2011&endPeriod=2022&by=relative&areaCode=E08000025`}
					/>
				</Step>

				<Step id="refusal" title="Know what not to do">
					<P>
						Some questions don't have a meaningful answer. A median
						house price can't be averaged across areas, so this is
						refused with `aggregation_not_supported` and an
						explanation:
					</P>
					<Request
						url={`${API}/data/house-price-median/aggregate?period=2022&geography=ward&boundaryYear=2020&areaCode=E92000001`}
					/>
					<Callout tone="note">
						Change is always measured within one set of area codes,
						so an area means the same place at the start and the
						end. Mixing in a boundary `release` is refused for the
						same reason.
					</Callout>
				</Step>

				<Step id="caveats" title="Quote the caveats">
					<P>
						Finally, fetch the measure's quality report. Each source
						has a coverage note, such as which nations are included,
						to show beside your chart.
					</P>
					<Request
						url={`${API}/measures/population-estimate/quality`}
					/>
				</Step>
			</Steps>
		</DocPage>
	);
}
