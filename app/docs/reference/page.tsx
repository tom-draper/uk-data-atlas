import type { Metadata } from "next";
import Link from "next/link";
import CopyButton from "@/components/docs/CopyButton";
import { CardGrid, DocPage, H2, LinkCard, P } from "@/components/docs/Content";
import { EndpointPath } from "@/components/docs/Endpoint";
import { Card } from "@/components/docs/Page";
import {
	endpointContent,
	sectionContent,
	sectionHref,
} from "@/lib/docs/navigation";
import {
	API_BASE_URL,
	allOperations,
	loadApiContract,
	operationHref,
	resourceGroups,
} from "@/lib/docs/openapi";

const TITLE = "API reference – UK Data Atlas";
const DESCRIPTION =
	"Every endpoint in the UK Data Atlas API, grouped by what it's for: places, observations, maps, analysis, bulk downloads, boundaries and citation.";

export const metadata: Metadata = {
	title: { absolute: TITLE },
	description: DESCRIPTION,
	alternates: { canonical: "/docs/reference" },
	openGraph: { title: TITLE, description: DESCRIPTION },
};

export default function ReferencePage() {
	const contract = loadApiContract();
	const count = allOperations(contract).length;

	return (
		<DocPage
			href="/docs/reference"
			eyebrow="API reference"
			title="Every endpoint, in one place"
			lede={`All ${count} endpoints, grouped by what they're for. The API is read-only, so every request is a simple GET you can try in your browser.`}
			toc={[
				{ id: "base-url", title: "Base URL" },
				{ id: "sections", title: "Sections" },
				{ id: "all-routes", title: "All routes" },
			]}
		>
			<H2 id="base-url">Base URL</H2>
			<P>Every path in this reference is relative to:</P>
			<Card className="flex max-w-[520px] items-center gap-3 py-2 pr-2 pl-4">
				<code className="min-w-0 flex-1 truncate font-mono text-[14px] text-slate-800">
					{API_BASE_URL}
				</code>
				<CopyButton
					value={API_BASE_URL}
					label="Copy base URL"
					tone="light"
				/>
			</Card>

			<H2 id="sections">Sections</H2>
			<CardGrid>
				{contract.sections.map((section) => {
					const content = sectionContent(section);
					return (
						<LinkCard
							key={section.slug}
							href={sectionHref(section)}
							title={content.title}
						>
							{content.intro}
							<span className="mt-2 block text-[12px] text-slate-400">
								{section.operations.length} endpoints
							</span>
						</LinkCard>
					);
				})}
			</CardGrid>

			<H2 id="all-routes">All routes</H2>
			<P>
				The same endpoints arranged by the resource they belong to,
				which is a quick way to see how the API is shaped.
			</P>
			<div className="columns-1 gap-3 md:columns-2">
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
								{group.operations.length}
							</span>
						</div>
						<ul className="space-y-0.5 border-l border-slate-900/[0.08] pl-3">
							{group.operations.map((op) => (
								<li key={op.id}>
									<Link
										href={operationHref(op)}
										title={endpointContent(op).title}
										className="-mx-1.5 block rounded px-1.5 py-0.5 text-[12.5px] text-slate-700 hover:bg-white/70 hover:text-slate-950"
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
		</DocPage>
	);
}
