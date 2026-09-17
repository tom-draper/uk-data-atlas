import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CodePanel, { RequestSamples } from "@/components/docs/CodePanel";
import { Callout, Pager } from "@/components/docs/Content";
import CopyButton from "@/components/docs/CopyButton";
import { EndpointPath, MethodBadge } from "@/components/docs/Endpoint";
import {
	Breadcrumbs,
	Card,
	Pill,
	SectionHeading,
	Sheet,
	statusTone,
} from "@/components/docs/Page";
import Prose, { Inline } from "@/components/docs/Prose";
import { FieldList, ParameterList } from "@/components/docs/Reference";
import {
	endpointContent,
	sectionContent,
	sectionHref,
} from "@/lib/docs/navigation";
import {
	API_BASE_URL,
	allOperations,
	findOperation,
	findSection,
	loadApiContract,
	operationHref,
} from "@/lib/docs/openapi";
import { operationExample } from "@/lib/docs/samples";

type Params = Promise<{ section: string; operation: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
	return allOperations(loadApiContract()).map((op) => ({
		section: op.sectionSlug,
		operation: op.slug,
	}));
}

export async function generateMetadata({
	params,
}: {
	params: Params;
}): Promise<Metadata> {
	const { section, operation } = await params;
	const op = findOperation(loadApiContract(), section, operation);
	if (!op) return {};
	const content = endpointContent(op);
	const title = `${content.title} – UK Data Atlas API`;
	const description = content.intro.replace(/[`*]|\[|\]\([^)]*\)/g, "");
	return {
		title: { absolute: title },
		description,
		alternates: { canonical: operationHref(op) },
		openGraph: { title, description },
	};
}

export default async function OperationPage({ params }: { params: Params }) {
	const { section: sectionSlug, operation: operationSlug } = await params;
	const contract = loadApiContract();
	const section = findSection(contract, sectionSlug);
	const op = findOperation(contract, sectionSlug, operationSlug);
	if (!section || !op) notFound();

	const content = endpointContent(op);
	const example = operationExample(op);
	const pathParameters = op.parameters.filter((p) => p.location === "path");
	const queryParameters = op.parameters.filter((p) => p.location !== "path");
	const success = op.responses.find((r) => r.status.startsWith("2"));
	const errors = op.responses.filter((r) => !r.status.startsWith("2"));

	return (
		<Sheet>
			<Breadcrumbs
				trail={[
					{ label: "API reference", href: "/docs/reference" },
					{
						label: sectionContent(section).title,
						href: sectionHref(section),
					},
				]}
			/>

			<h1 className="text-[30px] leading-tight font-semibold tracking-tight text-slate-900 sm:text-[36px]">
				{content.title}
			</h1>
			<p className="mt-3 max-w-[70ch] text-[17px] leading-[1.7] text-slate-600">
				<Inline text={content.intro} />
			</p>

			<Card className="mt-6 flex items-center gap-3 py-2 pr-2 pl-3">
				<MethodBadge method={op.method} />
				<div className="min-w-0 flex-1 text-[14px] text-slate-800">
					<span className="hidden text-slate-400 md:inline">
						{API_BASE_URL}
					</span>
					<EndpointPath path={op.path} />
				</div>
				<CopyButton
					value={`${API_BASE_URL}${op.path}`}
					label="Copy URL"
					tone="light"
				/>
			</Card>

			<div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
				<div className="min-w-0 space-y-12">
					{content.tips && content.tips.length > 0 && (
						<Callout tone="tip" title="Good to know">
							<ul className="mt-1.5 space-y-1.5">
								{content.tips.map((tip) => (
									<li key={tip} className="flex gap-2.5">
										<span className="mt-[10px] h-1 w-1 shrink-0 rounded-full bg-emerald-600/60" />
										<span>
											<Inline text={tip} />
										</span>
									</li>
								))}
							</ul>
						</Callout>
					)}

					{pathParameters.length > 0 && (
						<section>
							<SectionHeading id="path-parameters">
								Path parameters
							</SectionHeading>
							<ParameterList parameters={pathParameters} />
						</section>
					)}

					{queryParameters.length > 0 && (
						<section>
							<SectionHeading id="query-parameters">
								Query parameters
							</SectionHeading>
							<ParameterList parameters={queryParameters} />
						</section>
					)}

					{success && (
						<section>
							<SectionHeading
								id="returns"
								aside={
									success.schemaName && (
										<code className="font-mono text-[12px] text-slate-600">
											{success.schemaName}
										</code>
									)
								}
							>
								Returns
							</SectionHeading>
							<p className="text-[15px] leading-[1.7] text-slate-600">
								<Inline text={success.description} />
							</p>
							{success.fields.length > 0 && (
								<div className="mt-2">
									<FieldList fields={success.fields} />
								</div>
							)}
							{success.headers.length > 0 && (
								<div className="mt-4 space-y-3">
									{success.headers.map((header) => (
										<div key={header.name}>
											<p className="text-[13px] text-slate-500">
												Header{" "}
												<code className="font-mono font-semibold text-slate-900">
													{header.name}
												</code>
											</p>
											<Prose
												text={header.description}
												className="mt-1 !text-[14px]"
											/>
										</div>
									))}
								</div>
							)}
						</section>
					)}

					{errors.length > 0 && (
						<section>
							<SectionHeading id="errors">
								When it goes wrong
							</SectionHeading>
							<ul className="divide-y divide-slate-900/[0.06]">
								{errors.map((error) => (
									<li
										key={error.status}
										className="flex gap-4 py-3"
									>
										<span className="w-12 shrink-0 pt-0.5">
											<Pill
												tone={statusTone(error.status)}
											>
												<span className="font-mono">
													{error.status}
												</span>
											</Pill>
										</span>
										<span className="text-[14px] leading-[1.65] text-slate-600">
											<Inline text={error.description} />
										</span>
									</li>
								))}
							</ul>
							<p className="mt-3 text-[13.5px] text-slate-500">
								Every error has the same shape.{" "}
								<Inline text="See [Errors](/docs/errors) for how to handle them." />
							</p>
						</section>
					)}

					{op.description && (
						<section>
							<SectionHeading id="technical-notes">
								Technical notes
							</SectionHeading>
							<details className="docs-description group">
								<summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-slate-900/[0.08] bg-white/55 px-3 py-1 text-[13px] text-slate-600 select-none hover:bg-white/80 hover:text-slate-900">
									<span className="group-open:hidden">
										Show the precise behaviour
									</span>
									<span className="hidden group-open:inline">
										Hide the precise behaviour
									</span>
								</summary>
								<Prose
									text={op.description}
									className="mt-4 !text-[14px]"
								/>
							</details>
						</section>
					)}
				</div>

				<aside className="min-w-0">
					<div className="space-y-4 xl:sticky xl:top-[92px]">
						<RequestSamples
							title="Request"
							samples={example.samples}
						/>
						{example.response && (
							<CodePanel
								title="Response"
								language={
									example.response.isJson ? "json" : "text"
								}
								code={example.response.body}
								maxHeight="min(56vh, 600px)"
								badge={
									<span className="font-mono text-[10.5px] text-emerald-300/90">
										{example.response.status}
									</span>
								}
							/>
						)}
					</div>
				</aside>
			</div>

			<Pager href={operationHref(op)} />
		</Sheet>
	);
}
