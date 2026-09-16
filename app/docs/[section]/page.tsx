import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { EndpointPath, MethodBadge } from "@/components/docs/Endpoint";
import { Breadcrumbs, Card, Eyebrow, Sheet } from "@/components/docs/Page";
import Prose, { firstSentence } from "@/components/docs/Prose";
import { docsEnabled } from "@/lib/docs/mode";
import { findSection, loadApiContract } from "@/lib/docs/openapi";

type Params = Promise<{ section: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
	if (!docsEnabled()) return [];
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
	const title = `${section.name} – UK Data Atlas API`;
	return {
		title: { absolute: title },
		description: section.description,
		alternates: { canonical: `/docs/${section.slug}` },
		openGraph: { title, description: section.description },
	};
}

export default async function SectionPage({ params }: { params: Params }) {
	const contract = loadApiContract();
	const section = findSection(contract, (await params).section);
	if (!section) notFound();

	const position = contract.sections.indexOf(section);
	const next = contract.sections[position + 1];

	return (
		<Sheet>
			<Breadcrumbs
				trail={[
					{ label: "API", href: "/docs" },
					{ label: section.name },
				]}
			/>
			<Eyebrow>
				Section {position + 1} of {contract.sections.length}
			</Eyebrow>
			<h1 className="text-[32px] font-semibold tracking-tight text-slate-900">
				{section.name}
			</h1>
			<Prose
				text={section.description}
				className="mt-3 max-w-[68ch] !text-[16px]"
			/>

			<ul className="mt-8 space-y-2.5">
				{section.operations.map((op) => (
					<li key={op.slug}>
						<Link
							href={`/docs/${section.slug}/${op.slug}`}
							className="group block"
						>
							<Card className="px-4 py-3.5 transition-[background] group-hover:bg-white/80 sm:px-5">
								<div className="flex items-start gap-3">
									<div className="min-w-0 flex-1">
										<p className="text-[15px] font-medium text-slate-900 group-hover:text-indigo-700">
											{op.summary}
										</p>
										<div className="mt-1 flex items-center gap-2 text-[13px] text-slate-600">
											<MethodBadge
												method={op.method}
												size="sm"
											/>
											<EndpointPath path={op.path} />
										</div>
										{op.description && (
											<p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">
												{firstSentence(
													op.description,
													220,
												)}
											</p>
										)}
									</div>
									<ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
								</div>
							</Card>
						</Link>
					</li>
				))}
			</ul>

			{next && (
				<Link
					href={`/docs/${next.slug}`}
					className="group mt-10 flex items-center justify-end gap-2 border-t border-slate-900/[0.07] pt-6 text-[14px] text-slate-600 hover:text-indigo-700"
				>
					Next section:
					<span className="font-medium text-slate-900 group-hover:text-indigo-700">
						{next.name}
					</span>
					<ArrowRight className="h-4 w-4" />
				</Link>
			)}
		</Sheet>
	);
}
