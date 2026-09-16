import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import CodePanel from "@/components/docs/CodePanel";
import CopyButton from "@/components/docs/CopyButton";
import { EndpointPath, MethodBadge } from "@/components/docs/Endpoint";
import {
	Breadcrumbs,
	Card,
	Eyebrow,
	Pill,
	SectionHeading,
	Sheet,
	statusTone,
} from "@/components/docs/Page";
import Prose, { Description, firstSentence } from "@/components/docs/Prose";
import {
	FieldList,
	ParameterList,
	ResponseList,
} from "@/components/docs/Reference";
import { docsEnabled } from "@/lib/docs/mode";
import {
	API_BASE_URL,
	API_ORIGIN,
	allOperations,
	findOperation,
	findSection,
	loadApiContract,
	type DocsOperation,
} from "@/lib/docs/openapi";

type Params = Promise<{ section: string; operation: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
	if (!docsEnabled()) return [];
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
	const title = `${op.summary} – UK Data Atlas API`;
	const description = firstSentence(op.description || op.summary);
	return {
		title: { absolute: title },
		description,
		alternates: { canonical: `/docs/${section}/${operation}` },
		openGraph: { title, description },
	};
}

/** A runnable request: the spec's worked example, or the bare route. */
function exampleRequest(op: DocsOperation): string {
	const example = op.responses.find((r) => r.exampleRequest)?.exampleRequest;
	if (example) return `${API_ORIGIN}${example}`;
	const query = op.parameters
		.filter((p) => p.location === "query" && p.required)
		.map((p) => `${p.name}={${p.name}}`)
		.join("&");
	return `${API_BASE_URL}${op.path}${query ? `?${query}` : ""}`;
}

export default async function OperationPage({ params }: { params: Params }) {
	const { section: sectionSlug, operation: operationSlug } = await params;
	const contract = loadApiContract();
	const section = findSection(contract, sectionSlug);
	const op = findOperation(contract, sectionSlug, operationSlug);
	if (!section || !op) notFound();

	const operations = allOperations(contract);
	const index = operations.indexOf(op);
	const previous = operations[index - 1];
	const next = operations[index + 1];

	const pathParameters = op.parameters.filter((p) => p.location === "path");
	const queryParameters = op.parameters.filter((p) => p.location !== "path");
	const success = op.responses.find((r) => r.status.startsWith("2"));
	const errors = op.responses.filter((r) => !r.status.startsWith("2"));
	const exampleResponse = op.responses.find((r) => r.example);
	const request = exampleRequest(op);

	return (
		<Sheet>
			<Breadcrumbs
				trail={[
					{ label: "API", href: "/docs" },
					{ label: section.name, href: `/docs/${section.slug}` },
					{ label: op.summary },
				]}
			/>

			<Eyebrow>{section.name}</Eyebrow>
			<h1 className="text-[28px] leading-tight font-semibold tracking-tight text-slate-900 sm:text-[32px]">
				{op.summary}
			</h1>

			<Card className="mt-5 flex items-center gap-3 py-2 pr-2 pl-3">
				<MethodBadge method={op.method} />
				<div className="min-w-0 flex-1 text-[14px] text-slate-800">
					<span className="hidden text-slate-400 sm:inline">
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

			<div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
				<div className="min-w-0 space-y-10">
					{op.description && <Description text={op.description} />}

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

					{success && success.fields.length > 0 && (
						<section>
							<SectionHeading
								id="response-body"
								aside={
									success.schemaName && (
										<code className="font-mono text-[12px] text-indigo-600">
											{success.schemaName}
										</code>
									)
								}
							>
								Response body
							</SectionHeading>
							<FieldList fields={success.fields} />
						</section>
					)}

					{success && success.headers.length > 0 && (
						<section>
							<SectionHeading id="response-headers">
								Response headers
							</SectionHeading>
							<ul className="divide-y divide-slate-900/[0.06]">
								{success.headers.map((header) => (
									<li key={header.name} className="py-4">
										<code className="font-mono text-[13.5px] font-semibold text-slate-900">
											{header.name}
										</code>
										<Prose
											text={header.description}
											className="mt-1.5 !text-[14px]"
										/>
									</li>
								))}
							</ul>
						</section>
					)}

					<section>
						<SectionHeading
							id="responses"
							aside={`${op.responses.length} possible`}
						>
							Responses
						</SectionHeading>
						<ResponseList responses={op.responses} />
					</section>
				</div>

				<aside className="min-w-0">
					<div className="space-y-4 xl:sticky xl:top-[92px]">
						<CodePanel
							title="Request"
							language="shell"
							code={`curl "${request}"`}
							badge={<MethodBadge method={op.method} size="sm" />}
						/>
						{exampleResponse?.example && (
							<CodePanel
								title="Response"
								language={
									exampleResponse.example
										.trimStart()
										.startsWith("{")
										? "json"
										: "text"
								}
								code={exampleResponse.example}
								maxHeight="min(62vh, 640px)"
								badge={
									<span className="font-mono text-[10.5px] text-emerald-300/90">
										{exampleResponse.status}
									</span>
								}
							/>
						)}
						{errors.length > 0 && (
							<Card className="px-4 py-3">
								<p className="mb-2 text-[12px] font-medium text-slate-500">
									Can also return
								</p>
								<div className="flex flex-wrap gap-1.5">
									{errors.map((error) => (
										<span
											key={error.status}
											title={error.description}
										>
											<Pill
												tone={statusTone(error.status)}
											>
												<span className="font-mono">
													{error.status}
												</span>
											</Pill>
										</span>
									))}
								</div>
							</Card>
						)}
					</div>
				</aside>
			</div>

			<nav className="mt-14 grid gap-3 border-t border-slate-900/[0.07] pt-6 sm:grid-cols-2">
				{previous ? (
					<PagerLink op={previous} direction="previous" />
				) : (
					<span />
				)}
				{next && <PagerLink op={next} direction="next" />}
			</nav>
		</Sheet>
	);
}

function PagerLink({
	op,
	direction,
}: {
	op: DocsOperation;
	direction: "previous" | "next";
}) {
	const isNext = direction === "next";
	return (
		<Link
			href={`/docs/${op.sectionSlug}/${op.slug}`}
			className={`group rounded-xl border border-white/70 bg-white/35 px-4 py-3 transition-colors hover:bg-white/70 ${isNext ? "sm:text-right" : ""}`}
		>
			<span
				className={`flex items-center gap-1 text-[12px] text-slate-500 ${isNext ? "sm:justify-end" : ""}`}
			>
				{!isNext && <ArrowLeft className="h-3 w-3" />}
				{isNext ? "Next" : "Previous"}
				{isNext && <ArrowRight className="h-3 w-3" />}
			</span>
			<span className="mt-0.5 block text-[14px] font-medium text-slate-800 group-hover:text-indigo-700">
				{op.summary}
			</span>
		</Link>
	);
}
