import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import CodePanel from "@/components/docs/CodePanel";
import CopyButton from "@/components/docs/CopyButton";
import { EndpointPath, MethodBadge } from "@/components/docs/Endpoint";
import { Card, Eyebrow, SectionHeading, Sheet } from "@/components/docs/Page";
import Prose, { firstSentence } from "@/components/docs/Prose";
import { apiConcepts } from "@/lib/docs/concepts";
import { docsIndexable } from "@/lib/docs/mode";
import {
	API_BASE_URL,
	API_ORIGIN,
	allOperations,
	loadApiContract,
	resourceGroups,
	type DocsSection,
} from "@/lib/docs/openapi";

const TITLE = "API Reference – UK Data Atlas";
const DESCRIPTION =
	"Reference for the UK Data Atlas API: source-exact UK statistics joined to explicit boundary releases, with provenance, coverage and citation in every response.";

export const metadata: Metadata = {
	title: { absolute: TITLE },
	description: DESCRIPTION,
	alternates: { canonical: "/docs" },
	openGraph: { title: TITLE, description: DESCRIPTION },
};

/** What a caller sets out to do, as opposed to what those tasks stand on. */
const TASK_SECTIONS = new Set(["map", "trend", "sync"]);

export default function DocsOverviewPage() {
	const contract = loadApiContract();
	const operations = allOperations(contract);
	const [startHere, ...rest] = contract.sections;
	const tasks = rest.filter((s) => TASK_SECTIONS.has(s.slug));
	const foundations = rest.filter((s) => !TASK_SECTIONS.has(s.slug));
	const firstExample = startHere.operations
		.flatMap((op) => op.responses)
		.find(
			(r) => r.exampleRequest && r.example && r.exampleRequest !== "/v1",
		);

	return (
		<div className="space-y-4">
			<Sheet className="relative overflow-hidden">
				<div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)] xl:items-center">
					<div>
						<Eyebrow>API Reference · v{contract.version}</Eyebrow>
						<h1 className="text-[36px] leading-[1.1] font-semibold tracking-tight text-slate-900 sm:text-[46px]">
							UK Data Atlas API
						</h1>
						<p className="mt-4 max-w-[58ch] text-[17px] leading-[1.65] text-slate-600">
							Source-exact UK statistics, joined to the boundary
							release you choose. Every response says which areas,
							which boundaries, which period and which build it
							came from, so a map or trend drawn from it can be
							checked and cited.
						</p>

						<Card className="mt-6 flex max-w-[520px] items-center gap-3 py-2 pr-2 pl-4">
							<span className="text-[11px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
								Base URL
							</span>
							<code className="min-w-0 flex-1 truncate font-mono text-[14px] text-slate-800">
								{API_BASE_URL}
							</code>
							<CopyButton
								value={API_BASE_URL}
								label="Copy base URL"
								tone="light"
							/>
						</Card>

						<dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
							<Fact label="Endpoints" value={operations.length} />
							<Fact
								label="Sections"
								value={contract.sections.length}
							/>
							<Fact label="Access" value="Read-only" />
							<Fact label="Formats" value="JSON · CSV · NDJSON" />
						</dl>
					</div>

					{firstExample?.exampleRequest && firstExample.example && (
						<div className="min-w-0 space-y-3">
							<CodePanel
								title="Try it"
								language="shell"
								code={`curl "${API_ORIGIN}${firstExample.exampleRequest}"`}
							/>
							<CodePanel
								title="Response"
								language="json"
								code={firstExample.example}
								maxHeight="260px"
							/>
						</div>
					)}
				</div>

				{!docsIndexable() && (
					<div className="mt-8 flex gap-3 rounded-xl border border-amber-500/20 bg-amber-50/60 px-4 py-3 text-[14px] leading-relaxed text-amber-900">
						<Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
						<p>
							The API is not publicly available yet. These pages
							document the contract it is being built and tested
							against, so details may change before launch.
						</p>
					</div>
				)}
			</Sheet>

			<Sheet>
				<SectionHeading id="start-here" aside="the first calls to make">
					Start here
				</SectionHeading>
				<ol className="grid gap-3 md:grid-cols-2">
					{startHere.operations.map((op, i) => (
						<li key={op.slug}>
							<Link
								href={`/docs/${startHere.slug}/${op.slug}`}
								className="group block h-full"
							>
								<Card className="flex h-full gap-4 px-4 py-4 transition-[background] group-hover:bg-white/80">
									<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-white to-indigo-50 font-mono text-[12px] font-semibold text-indigo-700 shadow-[inset_0_1px_0_#fff,0_1px_3px_rgba(79,70,229,0.18)] ring-1 ring-indigo-600/10">
										{i + 1}
									</span>
									<div className="min-w-0">
										<p className="text-[15px] font-medium text-slate-900 group-hover:text-indigo-700">
											{op.summary}
										</p>
										<div className="mt-1 flex items-center gap-2 text-[12.5px] text-slate-600">
											<MethodBadge
												method={op.method}
												size="sm"
											/>
											<EndpointPath path={op.path} />
										</div>
										<p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">
											{firstSentence(op.description, 150)}
										</p>
									</div>
								</Card>
							</Link>
						</li>
					))}
				</ol>
			</Sheet>

			<Sheet>
				<SectionHeading
					id="structure"
					aside="how the reference is organised"
				>
					How the API fits together
				</SectionHeading>
				<SectionGroup
					label="Tasks"
					note="What you set out to do"
					sections={tasks}
				/>
				<div className="my-5 flex items-center gap-3 text-[12px] text-slate-400">
					<span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-900/10" />
					built on
					<span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-900/10" />
				</div>
				<SectionGroup
					label="Foundations"
					note="What every answer is checked against"
					sections={foundations}
				/>
			</Sheet>

			<Sheet>
				<SectionHeading id="concepts" aside="rules every route follows">
					Core concepts
				</SectionHeading>
				<div className="grid gap-3 lg:grid-cols-2">
					{apiConcepts(contract).map((concept) => (
						<Card key={concept.id} className="px-5 py-5">
							<h3
								id={concept.id}
								className="scroll-mt-24 text-[16px] font-semibold text-slate-900"
							>
								{concept.title}
							</h3>
							<Prose
								text={concept.text}
								className="mt-2 !text-[14px] !leading-[1.7]"
							/>
						</Card>
					))}
				</div>
			</Sheet>

			<Sheet>
				<SectionHeading
					id="resources"
					aside={`every route, by the resource it belongs to`}
				>
					Resource map
				</SectionHeading>
				<div className="columns-1 gap-3 md:columns-2 2xl:columns-3">
					{resourceGroups(contract).map((group) => (
						<Card
							key={group.resource}
							className="mb-3 break-inside-avoid px-4 py-3.5"
						>
							<div className="mb-2 flex items-baseline justify-between gap-2">
								<code className="font-mono text-[14px] font-semibold text-slate-900">
									{group.resource}
								</code>
								<span className="text-[11px] text-slate-400">
									{group.operations.length}{" "}
									{group.operations.length === 1
										? "route"
										: "routes"}
								</span>
							</div>
							<ul className="space-y-0.5 border-l border-slate-900/[0.08] pl-3">
								{group.operations.map((op) => (
									<li key={op.id}>
										<Link
											href={`/docs/${op.sectionSlug}/${op.slug}`}
											title={op.summary}
											className="-mx-1.5 block rounded px-1.5 py-0.5 text-[12.5px] text-slate-700 hover:bg-white/70 hover:text-indigo-700"
										>
											<EndpointPath
												path={op.path}
												dimPrefix={
													group.resource === "/"
														? undefined
														: group.resource
												}
											/>
										</Link>
									</li>
								))}
							</ul>
						</Card>
					))}
				</div>
			</Sheet>
		</div>
	);
}

function Fact({ label, value }: { label: string; value: string | number }) {
	return (
		<div>
			<dt className="text-[11px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
				{label}
			</dt>
			<dd className="mt-0.5 text-[15px] font-medium text-slate-800">
				{value}
			</dd>
		</div>
	);
}

function SectionGroup({
	label,
	note,
	sections,
}: {
	label: string;
	note: string;
	sections: DocsSection[];
}) {
	return (
		<div>
			<p className="mb-2.5 text-[13px] text-slate-500">
				<span className="font-semibold text-slate-700">{label}</span> ·{" "}
				{note}
			</p>
			<div className="grid gap-3 md:grid-cols-3">
				{sections.map((section) => (
					<Link
						key={section.slug}
						href={`/docs/${section.slug}`}
						className="group block"
					>
						<Card className="flex h-full flex-col px-4 py-4 transition-[background] group-hover:bg-white/80">
							<div className="flex items-baseline justify-between gap-2">
								<h3 className="text-[16px] font-semibold text-slate-900 group-hover:text-indigo-700">
									{section.name}
								</h3>
								<span className="text-[12px] text-slate-400">
									{section.operations.length}
								</span>
							</div>
							<p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-slate-500">
								{firstSentence(section.description, 180)}
							</p>
							<span className="mt-3 flex items-center gap-1 text-[12.5px] font-medium text-indigo-600">
								Browse
								<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
							</span>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
