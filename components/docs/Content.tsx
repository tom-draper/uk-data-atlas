import Link from "next/link";
import type { ReactNode } from "react";
import {
	ArrowLeft,
	ArrowRight,
	CircleAlert,
	Info,
	Lightbulb,
} from "lucide-react";
import { endpointContent, neighbours } from "@/lib/docs/navigation";
import {
	findOperationById,
	loadApiContract,
	operationHref,
} from "@/lib/docs/openapi";
import { EndpointPath, MethodBadge } from "./Endpoint";
import { Breadcrumbs, Card, Eyebrow, Sheet } from "./Page";
import { Inline } from "./Prose";

/**
 * The pieces written docs pages are made from. Pages compose these directly in
 * TSX, so they share one typography and every heading lands in the page's
 * contents list.
 */

export interface TocEntry {
	id: string;
	title: string;
}

export function DocPage({
	href,
	eyebrow,
	title,
	lede,
	toc = [],
	trail,
	children,
}: {
	href: string;
	eyebrow?: string;
	title: string;
	lede?: ReactNode;
	toc?: TocEntry[];
	trail?: { label: string; href?: string }[];
	children: ReactNode;
}) {
	return (
		<Sheet>
			<div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_200px]">
				<article className="min-w-0 max-w-[760px]">
					{trail && <Breadcrumbs trail={trail} />}
					{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
					<h1 className="text-[32px] leading-[1.15] font-semibold tracking-tight text-slate-900 sm:text-[38px]">
						{title}
					</h1>
					{lede && (
						<div className="mt-4 text-[17px] leading-[1.7] text-slate-600">
							{lede}
						</div>
					)}
					<div className="mt-2">{children}</div>
					<Pager href={href} />
				</article>
				{toc.length > 0 && (
					<nav aria-label="On this page" className="hidden xl:block">
						<div className="sticky top-[100px]">
							<p className="mb-3 text-[11px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
								On this page
							</p>
							<ul className="space-y-2 border-l border-slate-900/[0.08] text-[13px]">
								{toc.map((entry) => (
									<li key={entry.id}>
										<a
											href={`#${entry.id}`}
											className="-ml-px block border-l border-transparent pl-3 text-slate-500 hover:border-indigo-400 hover:text-slate-900"
										>
											{entry.title}
										</a>
									</li>
								))}
							</ul>
						</div>
					</nav>
				)}
			</div>
		</Sheet>
	);
}

export function Pager({ href }: { href: string }) {
	const { previous, next } = neighbours(loadApiContract(), href);
	if (!previous && !next) return null;
	return (
		<nav className="mt-16 grid gap-3 border-t border-slate-900/[0.07] pt-6 sm:grid-cols-2">
			{previous ? (
				<PagerLink href={previous.href} title={previous.title} />
			) : (
				<span />
			)}
			{next && <PagerLink href={next.href} title={next.title} isNext />}
		</nav>
	);
}

function PagerLink({
	href,
	title,
	isNext = false,
}: {
	href: string;
	title: string;
	isNext?: boolean;
}) {
	return (
		<Link
			href={href}
			className={`group rounded-xl border border-slate-900/[0.07] bg-white/60 px-4 py-3 transition-colors hover:bg-white/70 ${isNext ? "sm:text-right" : ""}`}
		>
			<span
				className={`flex items-center gap-1 text-[12px] text-slate-500 ${isNext ? "sm:justify-end" : ""}`}
			>
				{!isNext && <ArrowLeft className="h-3 w-3" />}
				{isNext ? "Next" : "Previous"}
				{isNext && <ArrowRight className="h-3 w-3" />}
			</span>
			<span className="mt-0.5 block text-[14px] font-medium text-slate-800 group-hover:text-indigo-700">
				{title}
			</span>
		</Link>
	);
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
	return (
		<h2
			id={id}
			className="group mt-14 mb-4 scroll-mt-24 text-[23px] font-semibold tracking-tight text-slate-900"
		>
			<a href={`#${id}`} className="no-underline">
				{children}
				<span
					aria-hidden
					className="ml-2 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
				>
					#
				</span>
			</a>
		</h2>
	);
}

/** A paragraph; a string may use `code`, **bold** and [links](/docs/...). */
export function P({ children }: { children: ReactNode }) {
	return (
		<p className="my-4 text-[15.5px] leading-[1.75] text-slate-600">
			{typeof children === "string" ? (
				<Inline text={children} />
			) : (
				children
			)}
		</p>
	);
}

export function List({ items }: { items: ReactNode[] }) {
	return (
		<ul className="my-4 space-y-2 text-[15.5px] leading-[1.7] text-slate-600">
			{items.map((item, i) => (
				<li key={i} className="flex gap-3">
					<span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400/70" />
					<span>
						{typeof item === "string" ? (
							<Inline text={item} />
						) : (
							item
						)}
					</span>
				</li>
			))}
		</ul>
	);
}

const CALLOUTS = {
	note: {
		icon: Info,
		box: "border-sky-500/20 bg-sky-50/60 text-sky-950",
		iconColour: "text-sky-600",
	},
	tip: {
		icon: Lightbulb,
		box: "border-emerald-500/20 bg-emerald-50/60 text-emerald-950",
		iconColour: "text-emerald-600",
	},
	warning: {
		icon: CircleAlert,
		box: "border-amber-500/25 bg-amber-50/70 text-amber-950",
		iconColour: "text-amber-600",
	},
};

export function Callout({
	tone = "note",
	title,
	children,
}: {
	tone?: keyof typeof CALLOUTS;
	title?: string;
	children: ReactNode;
}) {
	const style = CALLOUTS[tone];
	const Icon = style.icon;
	return (
		<div
			className={`my-6 flex gap-3 rounded-xl border px-4 py-3.5 text-[14.5px] leading-[1.7] ${style.box}`}
		>
			<Icon className={`mt-[3px] h-4 w-4 shrink-0 ${style.iconColour}`} />
			<div className="min-w-0 [&_p]:my-0">
				{title && <p className="font-semibold">{title}</p>}
				{typeof children === "string" ? (
					<p>
						<Inline text={children} />
					</p>
				) : (
					children
				)}
			</div>
		</div>
	);
}

/** Numbered steps joined by a line, for walkthroughs. */
export function Steps({ children }: { children: ReactNode }) {
	return (
		<ol className="relative my-8 [counter-reset:step] [&>li:last-child]:pb-0">
			{children}
		</ol>
	);
}

export function Step({
	id,
	title,
	children,
}: {
	id: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<li className="relative pb-10 pl-12 [counter-increment:step] before:absolute before:top-0 before:left-0 before:flex before:h-8 before:w-8 before:items-center before:justify-center before:rounded-full before:bg-gradient-to-b before:from-white before:to-indigo-50 before:font-mono before:text-[13px] before:font-semibold before:text-indigo-700 before:shadow-[inset_0_1px_0_#fff,0_1px_3px_rgba(79,70,229,0.2)] before:ring-1 before:ring-indigo-600/10 before:content-[counter(step)] after:absolute after:top-10 after:bottom-2 after:left-[15.5px] after:w-px after:bg-gradient-to-b after:from-indigo-200 after:to-transparent last:after:hidden">
			<h3
				id={id}
				className="scroll-mt-24 pt-1 text-[18px] font-semibold text-slate-900"
			>
				{title}
			</h3>
			<div className="[&>*:first-child]:mt-2">{children}</div>
		</li>
	);
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
	return (
		<div className="my-6 overflow-x-auto rounded-xl border border-slate-900/[0.07] bg-white/60">
			<table className="w-full text-left text-[14px]">
				<thead>
					<tr className="border-b border-slate-900/[0.07]">
						{head.map((cell) => (
							<th
								key={cell}
								className="px-4 py-2.5 text-[12px] font-semibold tracking-wide text-slate-500"
							>
								{cell}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="divide-y divide-slate-900/[0.05]">
					{rows.map((row, i) => (
						<tr key={i} className="align-top">
							{row.map((cell, j) => (
								<td
									key={j}
									className="px-4 py-3 leading-relaxed text-slate-600"
								>
									{typeof cell === "string" ? (
										<Inline text={cell} />
									) : (
										cell
									)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function CardGrid({
	children,
	columns = 2,
}: {
	children: ReactNode;
	columns?: 2 | 3;
}) {
	return (
		<div
			className={`my-6 grid gap-3 sm:grid-cols-2 ${columns === 3 ? "lg:grid-cols-3" : ""}`}
		>
			{children}
		</div>
	);
}

export function LinkCard({
	href,
	title,
	icon,
	children,
}: {
	href: string;
	title: string;
	icon?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Link href={href} className="group block h-full">
			<Card className="flex h-full flex-col px-4 py-4 transition-[background] group-hover:bg-white/80">
				{icon && (
					<span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-white to-indigo-50 text-indigo-600 shadow-[inset_0_1px_0_#fff,0_1px_3px_rgba(79,70,229,0.15)] ring-1 ring-indigo-600/10">
						{icon}
					</span>
				)}
				<span className="flex items-center gap-1 text-[15px] font-semibold text-slate-900 group-hover:text-indigo-700">
					{title}
					<ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
				</span>
				<span className="mt-1 text-[13.5px] leading-relaxed text-slate-500">
					{children}
				</span>
			</Card>
		</Link>
	);
}

/** A link to an endpoint's reference page, showing its method and route. */
export function EndpointRef({ id }: { id: string }) {
	const operation = findOperationById(loadApiContract(), id);
	return (
		<Link
			href={operationHref(operation)}
			className="group my-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-slate-900/[0.07] bg-white/60 px-3 py-2 text-[13px] transition-colors hover:bg-white/80"
		>
			<MethodBadge method={operation.method} size="sm" />
			<EndpointPath path={operation.path} className="text-slate-700" />
			<span className="ml-auto flex items-center gap-1 text-[12.5px] text-slate-500 group-hover:text-indigo-700">
				{endpointContent(operation).title}
				<ArrowRight className="h-3 w-3" />
			</span>
		</Link>
	);
}
