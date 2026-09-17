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
} from "lucide-react";
import CodePanel, { RequestSamples } from "@/components/docs/CodePanel";
import { CardGrid, H2, LinkCard, List, Pager } from "@/components/docs/Content";
import { Eyebrow, Sheet } from "@/components/docs/Page";
import { docsIndexable } from "@/lib/docs/mode";
import { findOperationById, loadApiContract } from "@/lib/docs/openapi";
import { operationExample } from "@/lib/docs/samples";

const TITLE = "UK Data Atlas API – official UK statistics for every area";
const DESCRIPTION =
	"A friendly API for official UK statistics: population, pay, house prices, deprivation, broadband, crime and more, for every ward, council and constituency, with boundaries to map them.";

export const metadata: Metadata = {
	title: { absolute: TITLE },
	description: DESCRIPTION,
	alternates: { canonical: "/docs" },
	openGraph: { title: TITLE, description: DESCRIPTION },
};

export default function IntroductionPage() {
	const contract = loadApiContract();
	const example = operationExample(
		findOperationById(contract, "getMeasureValueForPlace"),
	);

	return (
		<Sheet>
			<div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,470px)] xl:items-center">
				<div>
					<Eyebrow>Introduction</Eyebrow>
					<h1 className="text-[38px] leading-[1.08] font-semibold tracking-tight text-slate-900 sm:text-[50px]">
						UK Data Atlas API
					</h1>
					<p className="mt-5 max-w-[54ch] text-[18px] leading-[1.65] text-slate-600">
						Official statistics for every corner of the UK, from
						population and pay to broadband and air quality, ready
						to drop into your apps, maps and analysis.
					</p>
					<div className="mt-7 flex flex-wrap items-center gap-3">
						<Link
							href="/docs/quickstart"
							className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition-colors hover:bg-slate-800"
						>
							Make your first request
							<ArrowRight className="h-4 w-4" />
						</Link>
						<Link
							href="/docs/reference"
							className="inline-flex items-center gap-2 rounded-lg border border-white/80 bg-white/55 px-4 py-2.5 text-[14px] font-medium text-slate-800 transition-colors hover:bg-white/85"
						>
							Browse the reference
						</Link>
					</div>
					{!docsIndexable() && (
						<p className="mt-6 inline-flex rounded-full bg-amber-400/15 px-3 py-1 text-[12.5px] text-amber-900 ring-1 ring-amber-600/20">
							Coming soon. The API isn't live yet, so details may
							change.
						</p>
					)}
				</div>

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
			</div>

			<div className="max-w-[900px]">
				<H2 id="what-you-can-do">What you can do</H2>
				<CardGrid columns={3}>
					<LinkCard
						href="/docs/reference/start-here/resolve-places"
						title="Look up any place"
						icon={<Search className="h-4 w-4" />}
					>
						Turn a name like “Newport” into the exact areas it could
						mean.
					</LinkCard>
					<LinkCard
						href="/docs/reference/map/measure-observations"
						title="Get the numbers"
						icon={<Table2 className="h-4 w-4" />}
					>
						Fetch values exactly as ONS and other publishers
						released them.
					</LinkCard>
					<LinkCard
						href="/docs/guides/map"
						title="Draw maps"
						icon={<Map className="h-4 w-4" />}
					>
						Boundaries, vector tiles and values that are guaranteed
						to line up.
					</LinkCard>
					<LinkCard
						href="/docs/guides/trend"
						title="Spot trends"
						icon={<ChartLine className="h-4 w-4" />}
					>
						Time series, rankings and change between any two
						periods.
					</LinkCard>
					<LinkCard
						href="/docs/guides/sync"
						title="Download everything"
						icon={<Download className="h-4 w-4" />}
					>
						Whole datasets and lookup tables in one request each.
					</LinkCard>
					<LinkCard
						href="/docs/reference/governance/attribution"
						title="Cite your sources"
						icon={<Quote className="h-4 w-4" />}
					>
						Ready-made attribution and licence text for what you
						publish.
					</LinkCard>
				</CardGrid>

				<H2 id="why">Why it's different</H2>
				<List
					items={[
						"**Nothing is guessed.** Values come back exactly as they were published. If something needs converting or adding up, you ask for that explicitly.",
						"**Every answer shows its working.** Responses say which areas, boundaries and period they describe, and which release of the Atlas produced them.",
						"**It says no rather than mislead.** Ask for an average of medians and you'll get a clear explanation, not a number that looks right but isn't.",
					]}
				/>

				<H2 id="next">Where next</H2>
				<CardGrid columns={3}>
					<LinkCard
						href="/docs/quickstart"
						title="Quickstart"
						icon={<ArrowRight className="h-4 w-4" />}
					>
						Five requests, five minutes, no setup.
					</LinkCard>
					<LinkCard
						href="/docs/concepts/measures"
						title="Concepts"
						icon={<BookOpen className="h-4 w-4" />}
					>
						The handful of ideas that make everything click.
					</LinkCard>
					<LinkCard
						href="/docs/reference"
						title="API reference"
						icon={<Table2 className="h-4 w-4" />}
					>
						Every endpoint, parameter and response.
					</LinkCard>
				</CardGrid>

				<Pager href="/docs" />
			</div>
		</Sheet>
	);
}
