import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
	Callout,
	DocPage,
	EndpointRef,
	H2,
	List,
	P,
	Table,
} from "@/components/docs/Content";
import { Request } from "@/components/docs/Example";
import Facts from "@/components/docs/Facts";
import { TextLink } from "@/components/docs/Prose";
import { nationList, periodRange } from "@/lib/docs/catalogue";
import { DATA_PAGES, DATA_TOPICS } from "@/lib/docs/content/data";
import { GEOGRAPHIES } from "@/lib/docs/content/geographies";
import {
	capitalise,
	combining,
	dataPageFacts,
	findDataPage,
	yearSpan,
} from "@/lib/docs/dataPages";
import { docsMetadata } from "@/lib/docs/metadata";
import { dataPageHref, geographyHref } from "@/lib/docs/navigation";
import { API_BASE_URL } from "@/lib/docs/openapi";

type Params = Promise<{ slug: string }>;

const VISIBLE_NOTES = 6;

export const dynamicParams = false;

export function generateStaticParams() {
	return DATA_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const page = findDataPage((await params).slug);
	if (!page) return {};
	return docsMetadata(
		`${page.title} data by area`,
		page.intro,
		dataPageHref(page.slug),
	);
}

function geographyName(geography: string): string {
	return GEOGRAPHIES[geography]?.title ?? geography;
}

export default async function DataTopicPage({ params }: { params: Params }) {
	const page = findDataPage((await params).slug);
	if (!page) notFound();
	const facts = dataPageFacts(page);
	const topic = DATA_TOPICS.find((t) => t.id === page.topic);

	// A request that works: the first measure on its first published period.
	const sample = facts.sources.find((s) => s.periods.length > 0);
	const sampleMeasure = sample?.measureIds[0] ?? facts.measures[0]?.id;
	const notes = [
		...new Set(
			facts.measures.flatMap((m) => [
				...(m.notes ?? []),
				...(m.aggregation.note ? [m.aggregation.note] : []),
				...(m.derivedFrom?.note ? [m.derivedFrom.note] : []),
			]),
		),
	];

	return (
		<DocPage
			href={dataPageHref(page.slug)}
			trail={[
				{ label: "Data", href: "/docs/data" },
				{ label: topic?.title ?? "", href: `/docs/data#${page.topic}` },
			]}
			title={`${page.title} data`}
			lede={page.intro}
			toc={[
				{ id: "measures", title: "Measures" },
				{ id: "coverage", title: "Areas and years" },
				...(notes.length > 0
					? [{ id: "notes", title: "Things to know" }]
					: []),
				{ id: "request", title: "Request it" },
				{ id: "source", title: "Source and licence" },
			]}
		>
			<Facts
				items={[
					{
						label: "Published by",
						value: facts.publishers.join("; "),
					},
					{ label: "Covers", value: capitalise(facts.nations) },
					{
						label: "Years",
						value: facts.singlePeriod ?? yearSpan(facts.years),
					},
					{
						label: "Areas",
						value: facts.geographies.map((geography, i) => (
							<span key={geography}>
								{i > 0 && ", "}
								<TextLink href={geographyHref(geography)}>
									{geographyName(geography)}
								</TextLink>
							</span>
						)),
					},
				]}
			/>

			<H2 id="measures">Measures</H2>
			<P>
				Each measure is one kind of value you can request, using its id.
			</P>
			<Table
				head={["Measure", "Unit", "Combining areas"]}
				rows={facts.measures.map((measure) => [
					<span key="measure">
						<span className="block font-medium text-slate-900">
							{measure.label}
						</span>
						<code className="font-mono text-[12.5px] text-slate-500">
							{measure.id}
						</code>
					</span>,
					measure.unit,
					combining(measure),
				])}
			/>
			<P>
				“Adds up” means you can total it over areas or convert it to
				other areas. See [Measures and
				periods](/docs/concepts/measures#combining) for why some can't
				be combined.
			</P>

			<H2 id="coverage">Areas and years</H2>
			<P>
				Request each of these with its geography and code year as
				`geography` and `boundaryYear`.
			</P>
			<Table
				head={["Areas", "Code year", "Periods", "Covers", "Records"]}
				rows={facts.sources.map((source) => [
					<TextLink key="geo" href={geographyHref(source.geography)}>
						{geographyName(source.geography)}
					</TextLink>,
					`\`${source.boundaryYear}\``,
					periodRange(source.periods),
					capitalise(nationList(source.countries)),
					source.recordCount.toLocaleString("en-GB"),
				])}
			/>

			{notes.length > 0 && (
				<>
					<H2 id="notes">Things to know</H2>
					<List items={notes.slice(0, VISIBLE_NOTES)} />
					{notes.length > VISIBLE_NOTES && (
						<details className="docs-description group">
							<summary className="inline-flex cursor-pointer list-none items-center rounded-full border border-slate-900/[0.08] bg-white/60 px-3 py-1 text-[13px] text-slate-600 select-none hover:bg-white hover:text-slate-900">
								<span className="group-open:hidden">
									{`Show ${notes.length - VISIBLE_NOTES} more`}
								</span>
								<span className="hidden group-open:inline">
									Show fewer
								</span>
							</summary>
							<List items={notes.slice(VISIBLE_NOTES)} />
						</details>
					)}
				</>
			)}

			<H2 id="request">Request it</H2>
			{sample && sampleMeasure ? (
				<>
					<P>
						{`Get the first page of \`${sampleMeasure}\` for ${geographyName(sample.geography).toLowerCase()}:`}
					</P>
					<Request
						url={`${API_BASE_URL}/data/${sampleMeasure}?period=${encodeURIComponent(sample.periods.at(-1) ?? "")}&geography=${sample.geography}&boundaryYear=${sample.boundaryYear}&limit=5`}
					/>
				</>
			) : null}
			{sampleMeasure && (
				<>
					<P>
						Read the measure's full definition, including every
						period it's published for:
					</P>
					<Request
						url={`${API_BASE_URL}/measures/${sampleMeasure}`}
					/>
				</>
			)}
			<EndpointRef id="getMeasureObservations" />
			<EndpointRef id="getSourceExactMeasureSeries" />

			<H2 id="source">Source and licence</H2>
			<Table
				head={["Dataset", "Publisher", "Licence"]}
				rows={facts.datasets.map((dataset) => [
					dataset.sourceUrl ? (
						<a
							key="source"
							href={dataset.sourceUrl}
							rel="noopener"
							className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-[3px]"
						>
							{dataset.label}
						</a>
					) : (
						dataset.label
					),
					dataset.publisher,
					dataset.licence?.url ? (
						<a
							key="licence"
							href={dataset.licence.url}
							rel="noopener"
							className="text-indigo-700 underline decoration-indigo-300 underline-offset-[3px]"
						>
							{dataset.licence.name}
						</a>
					) : (
						(dataset.licence?.name ?? "Not stated")
					),
				])}
			/>
			<Callout tone="tip">
				{`Using this data in something you publish? [Get attribution text](/docs/reference/governance/attribution) with \`measure=${sampleMeasure ?? ""}\` returns the credit line to include.`}
			</Callout>
		</DocPage>
	);
}
