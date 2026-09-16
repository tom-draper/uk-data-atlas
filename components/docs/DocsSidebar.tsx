"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import type { HttpMethod } from "@/lib/docs/openapi";
import { MethodBadge } from "./Endpoint";

export interface SidebarSection {
	name: string;
	slug: string;
	operations: {
		slug: string;
		method: HttpMethod;
		path: string;
		summary: string;
	}[];
}

export default function DocsSidebar({
	sections,
	onNavigate,
}: {
	sections: SidebarSection[];
	onNavigate?: () => void;
}) {
	const pathname = usePathname();
	const [query, setQuery] = useState("");
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const needle = query.trim().toLowerCase();

	const visible = sections
		.map((section) => ({
			...section,
			operations: needle
				? section.operations.filter((op) =>
						`${op.summary} ${op.path}`
							.toLowerCase()
							.includes(needle),
					)
				: section.operations,
		}))
		.filter((section) => !needle || section.operations.length > 0);

	function toggle(slug: string) {
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(slug)) next.delete(slug);
			else next.add(slug);
			return next;
		});
	}

	return (
		<nav aria-label="API reference" className="flex min-h-0 flex-col">
			<label className="relative mx-3 mt-3 mb-2 block">
				<span className="sr-only">Filter endpoints</span>
				<Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Filter endpoints"
					className="w-full rounded-md border border-white/60 bg-white/45 py-1.5 pr-2 pl-8 text-[13px] text-slate-700 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white/70 focus:ring-2 focus:ring-indigo-500/15"
				/>
			</label>

			<div className="docs-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-4">
				<SidebarLink
					href="/docs"
					active={pathname === "/docs"}
					onNavigate={onNavigate}
				>
					Overview
				</SidebarLink>

				{visible.map((section) => {
					const sectionHref = `/docs/${section.slug}`;
					const open = needle !== "" || !collapsed.has(section.slug);
					return (
						<div key={section.slug} className="mt-4">
							<div className="flex items-center">
								<Link
									href={sectionHref}
									onClick={onNavigate}
									className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors ${
										pathname === sectionHref
											? "text-indigo-700"
											: "text-slate-500 hover:text-slate-800"
									}`}
								>
									{section.name}
								</Link>
								<button
									type="button"
									onClick={() => toggle(section.slug)}
									aria-expanded={open}
									aria-label={`${open ? "Collapse" : "Expand"} ${section.name}`}
									className="cursor-pointer rounded p-1 text-slate-400 hover:bg-white/50 hover:text-slate-700"
								>
									<ChevronRight
										className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
									/>
								</button>
							</div>
							{open && (
								<ul className="mt-0.5 space-y-px">
									{section.operations.map((op) => {
										const href = `${sectionHref}/${op.slug}`;
										return (
											<li key={op.slug}>
												<SidebarLink
													href={href}
													active={pathname === href}
													onNavigate={onNavigate}
													title={op.path}
												>
													<MethodBadge
														method={op.method}
														size="sm"
													/>
													<span className="truncate">
														{op.summary}
													</span>
												</SidebarLink>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					);
				})}

				{visible.length === 0 && (
					<p className="px-2 py-6 text-center text-[13px] text-slate-500">
						No endpoints match “{query}”.
					</p>
				)}
			</div>
		</nav>
	);
}

function SidebarLink({
	href,
	active,
	onNavigate,
	title,
	children,
}: {
	href: string;
	active: boolean;
	onNavigate?: () => void;
	title?: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			onClick={onNavigate}
			title={title}
			aria-current={active ? "page" : undefined}
			className={`flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] transition-colors ${
				active
					? "bg-white/70 font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_3px_rgba(15,23,42,0.08)]"
					: "text-slate-600 hover:bg-white/40 hover:text-slate-900"
			}`}
		>
			{children}
		</Link>
	);
}
