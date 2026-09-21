import type { Metadata } from "next";
import Link from "next/link";
import {
	ArrowRight,
	BookOpen,
	ChartLine,
	Download,
	Map,
	Quote,
	Search,
	Table2,
	LocateFixed,
} from "lucide-react";
import CodePanel, { RequestSamples } from "@/components/docs/CodePanel";
import {
	CardGrid,
	H2,
	LinkCard,
	List,
	P,
	Pager,
} from "@/components/docs/Content";
import { Eyebrow, Sheet } from "@/components/docs/Page";
import { findOperationById, loadApiContract } from "@/lib/docs/openapi";
import { operationExample } from "@/lib/docs/samples";

const TITLE =
	"UK Data Atlas API - Official Statistics for Every Corner of the UK";
const DESCRIPTION =
	"A friendly API for official UK statistics: population, pay, house prices, deprivation, broadband, crime and more, for every ward, council and constituency, with boundaries to map them.";

export const metadata: Metadata = {
	title: { absolute: TITLE },
	description: DESCRIPTION,
	alternates: { canonical: "/docs/v1" },
	openGraph: { title: TITLE, description: DESCRIPTION },
};

export default function IntroductionPage() {
	const contract = loadApiContract();
	const example = operationExample(
		findOperationById(contract, "getMeasureValueForPlace"),
	);

	return (
		<Sheet>
			<div className="pt-20 pb-8">
				<Eyebrow>Introduction</Eyebrow>
				<h1 className="text-[38px] leading-[1.08] font-semibold tracking-tight text-slate-900 sm:text-[50px]">
					UK Data Atlas API
				</h1>
				<p className="mt-5 max-w-[64ch] text-[18px] leading-[1.65] text-slate-600">
					Official statistics for every corner of the UK, from
					population and pay to broadband and air quality, ready to
					drop into your apps, maps and analysis.
				</p>
				<div className="mt-7 flex flex-wrap items-center gap-3">
					<Link
						href="/docs/v1/quickstart"
						className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-colors hover:bg-slate-800"
					>
						Make your first request
						<ArrowRight className="h-4 w-4" />
					</Link>
					<Link
						href="/docs/v1/reference"
						className="inline-flex items-center gap-2 rounded-md border border-white/80 bg-white/55 px-4 py-2.5 text-[14px] font-medium text-slate-800 transition-colors hover:bg-white/85"
					>
						Browse the reference
					</Link>
				</div>
				{/* Remove once the API is deployed. */}
				<p className="mt-6 inline-flex rounded-full bg-amber-400/15 px-3 py-1 text-[12.5px] text-amber-900 ring-1 ring-amber-600/20">
					Coming soon. The API isn't live yet, so details may change.
				</p>
			</div>

			<div className="max-w-[900px]">
				<H2 id="what-you-can-do">What you can do</H2>
				<CardGrid columns={3}>
					<LinkCard
						href="/docs/v1/reference/start-here/resolve-places"
						title="Look up any place"
						icon={<Search className="h-4 w-4" />}
					>
						Turn a name like “Newport” into the exact areas it could
						mean.
					</LinkCard>
					<LinkCard
						href="/docs/v1/reference/map/measure-observations"
						title="Get the numbers"
						icon={<Table2 className="h-4 w-4" />}
					>
						Fetch values exactly as ONS and other publishers
						released them.
					</LinkCard>
					<LinkCard
						href="/docs/v1/guides/map"
						title="Draw maps"
						icon={<Map className="h-4 w-4" />}
					>
						Boundaries, vector tiles and values that are guaranteed
						to line up.
					</LinkCard>
					<LinkCard
						href="/docs/v1/guides/trend"
						title="Spot trends"
						icon={<ChartLine className="h-4 w-4" />}
					>
						Time series, rankings and change between any two
						periods.
					</LinkCard>
					<LinkCard
						href="/docs/v1/guides/coordinate"
						title="Explore a coordinate"
						icon={<LocateFixed className="h-4 w-4" />}
					>
						Turn a latitude and longitude into the areas and
						statistics it describes.
					</LinkCard>
					<LinkCard
						href="/docs/v1/guides/batch-locations"
						title="Locate a batch of points"
					>
						Match a spreadsheet of coordinates to areas, including
						points outside coverage.
					</LinkCard>
					<LinkCard
						href="/docs/v1/guides/named-place"
						title="Explore a named place"
						icon={<Search className="h-4 w-4" />}
					>
						Work from names like North Wales or Greater Manchester
						without guessing their boundaries.
					</LinkCard>
					<LinkCard
						href="/docs/v1/guides/sync"
						title="Download everything"
						icon={<Download className="h-4 w-4" />}
					>
						Whole datasets and lookup tables in one request each.
					</LinkCard>
					<LinkCard
						href="/docs/v1/reference/governance/attribution"
						title="Cite your sources"
						icon={<Quote className="h-4 w-4" />}
					>
						Ready-made attribution and licence text for what you
						publish.
					</LinkCard>
				</CardGrid>

				<H2 id="why-the-api-exists">Why the API exists</H2>
				<P>
					UK public data is fragmented, inconsistent, and often
					difficult to use. Boundaries change between years, location
					codes and names go missing, and datasets across England,
					Wales, Scotland and Northern Ireland rarely line up cleanly.
				</P>
				<P>
					While building the UK Data Atlas, we collected, cleaned,
					repaired and standardised this data ourselves. The API makes
					that work available to everyone, giving you one consistent
					way to access UK public datasets, boundaries and geographic
					mappings without having to clean them first.
				</P>

				<H2 id="why">Why it's different</H2>
				<List
					items={[
						"**Nothing is guessed.** Values come back exactly as they were published. If something needs converting or adding up, you ask for that explicitly.",
						"**Every answer shows its working.** Responses say which areas, boundaries and period they describe, and which release of the Atlas produced them.",
						"**It says no rather than mislead.** Ask for an average of medians and you'll get a clear explanation, not a number that looks right but isn't.",
					]}
				/>
			</div>

			<section aria-labelledby="try-it" className="mt-14">
				<H2 id="try-it">Try a question</H2>
				<p className="mb-5 max-w-[70ch] text-[15.5px] leading-[1.75] text-slate-600">
					Ask for a statistic in the language you use, then see the
					request and response the API would return.
				</p>
				<div className="min-w-0 space-y-3">
					<RequestSamples
						title="Ask a question"
						samples={example.samples}
					/>
					{example.response && (
						<CodePanel
							title="Get an answer"
							language="json"
							code={example.response.body}
							maxHeight="250px"
						/>
					)}
				</div>
			</section>

			<div className="max-w-[900px]">
				<H2 id="next">Where next</H2>
				<CardGrid columns={3}>
					<LinkCard
						href="/docs/v1/quickstart"
						title="Quickstart"
						icon={<ArrowRight className="h-4 w-4" />}
					>
						Five requests, five minutes, no setup.
					</LinkCard>
					<LinkCard
						href="/docs/v1/concepts/measures"
						title="Concepts"
						icon={<BookOpen className="h-4 w-4" />}
					>
						The handful of ideas that make everything click.
					</LinkCard>
					<LinkCard
						href="/docs/v1/reference"
						title="API reference"
						icon={<Table2 className="h-4 w-4" />}
					>
						Every endpoint, parameter and response.
					</LinkCard>
				</CardGrid>

				<Pager href="/docs/v1" />
			</div>
		</Sheet>
	);
}
