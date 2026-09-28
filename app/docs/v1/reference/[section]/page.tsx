import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Pager } from "@/components/docs/Content";
import { EndpointPath, MethodBadge } from "@/components/docs/Endpoint";
import { Breadcrumbs, Card, Eyebrow, Sheet } from "@/components/docs/Page";
import { Inline } from "@/components/docs/Prose";
import {
	endpointContent,
	sectionContent,
	sectionHref,
} from "@/lib/docs/navigation";
import {
	findSection,
	loadApiContract,
	operationHref,
} from "@/lib/docs/openapi";
import { titleCase } from "@/lib/docs/metadata";

type Params = Promise<{ section: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
	return loadApiContract().sections.map((section) => ({
		section: section.slug,
	}));
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const section = findSection(loadApiContract(), (await params).section);
	if (!section) return {};
	const content = sectionContent(section);
	const title = `${titleCase(content.title)} - UK Data Atlas API Reference`;
	return {
		title: { absolute: title },
		description: content.intro,
		alternates: { canonical: sectionHref(section) },
		openGraph: { title, description: content.intro },
	};
}

export default async function SectionPage({ params }: { params: Params }) {
	const contract = loadApiContract();
	const section = findSection(contract, (await params).section);
	if (!section) notFound();
	const content = sectionContent(section);

	return (
		<Sheet>
			<Breadcrumbs
				trail={[
					{ label: "API reference", href: "/docs/v1/reference" },
					{ label: content.title },
				]}
			/>
			<Eyebrow>
				{section.operations.length} endpoint
				{section.operations.length === 1 ? "" : "s"}
			</Eyebrow>
			<h1 className="text-[32px] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
				{content.title}
			</h1>
			<p className="mt-3 max-w-[64ch] text-[17px] leading-[1.7] text-slate-600">
				{content.intro}
			</p>

			<ul className="mt-9 grid gap-3 lg:grid-cols-2">
				{section.operations.map((op) => {
					const endpoint = endpointContent(op);
					return (
						<li key={op.slug}>
							<Link
								href={operationHref(op)}
								className="group block h-full"
							>
								<Card className="flex h-full flex-col px-5 py-4 transition-[background] group-hover:bg-white/80">
									<span className="flex items-center justify-between gap-3">
										<span className="text-[15.5px] font-semibold text-slate-900 group-hover:text-slate-950">
											{endpoint.title}
										</span>
										<ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-600" />
									</span>
									<span className="mt-1.5 line-clamp-2 flex-1 text-[13.5px] leading-relaxed text-slate-500">
										<Inline
											text={endpoint.intro.replace(
												/\[([^\]]+)\]\([^)]*\)/g,
												"$1",
											)}
										/>
									</span>
									<span className="mt-3 flex min-w-0 items-center gap-2 text-[12.5px] text-slate-600">
										<MethodBadge
											method={op.method}
											size="sm"
										/>
										<EndpointPath path={op.path} />
									</span>
								</Card>
							</Link>
						</li>
					);
				})}
			</ul>

			<Pager href={sectionHref(section)} />
		</Sheet>
	);
}
