"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import type { NavGroup, NavLink } from "@/lib/docs/navigation";

function matches(link: NavLink, needle: string): boolean {
	return `${link.title} ${link.keywords ?? ""}`
		.toLowerCase()
		.includes(needle);
}

/** Keep links that match, and parents of links that match. */
function filterLinks(links: NavLink[], needle: string): NavLink[] {
	return links.flatMap((link) => {
		const children = filterLinks(link.children ?? [], needle);
		if (children.length > 0) return [{ ...link, children }];
		return matches(link, needle) ? [{ ...link, children: [] }] : [];
	});
}

function contains(link: NavLink, pathname: string): boolean {
	return (
		link.href === pathname ||
		(link.children ?? []).some((child) => contains(child, pathname))
	);
}

export default function DocsSidebar({
	groups,
	onNavigate,
}: {
	groups: NavGroup[];
	onNavigate?: () => void;
}) {
	const pathname = usePathname();
	const [query, setQuery] = useState("");
	// Parents open around the page being read; a click flips that default.
	const [flipped, setFlipped] = useState<Set<string>>(new Set());
	const needle = query.trim().toLowerCase();

	const visible = groups
		.map((group) => ({
			...group,
			links: needle ? filterLinks(group.links, needle) : group.links,
		}))
		.filter((group) => group.links.length > 0);

	function isOpen(link: NavLink) {
		if (needle) return true;
		const reading = contains(link, pathname);
		return flipped.has(link.href) ? !reading : reading;
	}

	function toggle(href: string) {
		setFlipped((current) => {
			const next = new Set(current);
			if (next.has(href)) next.delete(href);
			else next.add(href);
			return next;
		});
	}

	return (
		<nav aria-label="Documentation" className="flex min-h-0 flex-col">
			<label className="relative mb-2 block">
				<span className="sr-only">Search the docs</span>
				<Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search the docs"
					className="w-full rounded-md border border-slate-900/[0.08] bg-white/70 py-1.5 pr-2 pl-8 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-500/15"
				/>
			</label>

			<div className="docs-scroll -mr-2 min-h-0 flex-1 overflow-y-auto pr-2 pb-8">
				{visible.map((group) => (
					<div key={group.title} className="mt-6 first:mt-3">
						<p className="mb-1 px-2 text-[13.5px] font-semibold text-slate-900">
							{group.title}
						</p>
						<ul className="space-y-px">
							{group.links.map((link) => (
								<li key={link.href}>
									{link.children &&
									link.children.length > 0 ? (
										<ParentLink
											link={link}
											open={isOpen(link)}
											pathname={pathname}
											onToggle={() => toggle(link.href)}
											onNavigate={onNavigate}
										/>
									) : (
										<SidebarLink
											href={link.href}
											active={pathname === link.href}
											onNavigate={onNavigate}
										>
											{link.title}
										</SidebarLink>
									)}
								</li>
							))}
						</ul>
					</div>
				))}

				{visible.length === 0 && (
					<p className="px-2 py-6 text-center text-[13px] text-slate-500">
						Nothing matches “{query}”.
					</p>
				)}
			</div>
		</nav>
	);
}

function ParentLink({
	link,
	open,
	pathname,
	onToggle,
	onNavigate,
}: {
	link: NavLink;
	open: boolean;
	pathname: string;
	onToggle: () => void;
	onNavigate?: () => void;
}) {
	return (
		<>
			<div className="flex items-center">
				<SidebarLink
					href={link.href}
					active={pathname === link.href}
					onNavigate={onNavigate}
				>
					{link.title}
				</SidebarLink>
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={open}
					aria-label={`${open ? "Collapse" : "Expand"} ${link.title}`}
					className="ml-auto cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-900/[0.04] hover:text-slate-700"
				>
					<ChevronRight
						className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
					/>
				</button>
			</div>
			{open && (
				<ul className="mt-0.5 mb-2 ml-3 border-l border-slate-900/[0.08]">
					{(link.children ?? []).map((child) => {
						const active = pathname === child.href;
						return (
							<li key={child.href}>
								<Link
									href={child.href}
									onClick={onNavigate}
									title={child.keywords}
									aria-current={active ? "page" : undefined}
									className={`-ml-px block border-l py-[5px] pr-2 pl-3 text-[13px] leading-snug transition-colors ${
										active
											? "border-slate-700 font-medium text-slate-900"
											: "border-transparent text-slate-500 hover:border-slate-400 hover:text-slate-900"
									}`}
								>
									{child.title}
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</>
	);
}

function SidebarLink({
	href,
	active,
	onNavigate,
	children,
}: {
	href: string;
	active: boolean;
	onNavigate?: () => void;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			onClick={onNavigate}
			aria-current={active ? "page" : undefined}
			className={`block min-w-0 flex-1 rounded-md px-2 py-[5px] text-[13.5px] transition-colors ${
				active
					? "bg-slate-900/[0.07] font-medium text-slate-900"
					: "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
			}`}
		>
			{children}
		</Link>
	);
}
