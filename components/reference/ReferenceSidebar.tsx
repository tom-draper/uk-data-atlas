"use client";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

export interface ReferenceGroup {
	title: string;
	links: { id: string; title: string }[];
}

/** The page's sections, following the one being read. */
export default function ReferenceSidebar({
	label,
	groups,
}: {
	label: string;
	groups: ReferenceGroup[];
}) {
	const [query, setQuery] = useState("");
	const [current, setCurrent] = useState<string | null>(null);
	const list = useRef<HTMLDivElement>(null);
	const needle = query.trim().toLowerCase();

	useEffect(() => {
		const ids = groups.flatMap((group) => group.links.map((l) => l.id));
		const sections = ids
			.map((id) => document.getElementById(id))
			.filter((section) => section !== null);
		// The last section whose heading has passed the top third of the screen.
		const update = () => {
			const line = window.innerHeight / 3;
			let reading: string | null = null;
			for (const section of sections) {
				if (section.getBoundingClientRect().top > line) break;
				reading = section.id;
			}
			setCurrent(reading ?? ids[0] ?? null);
		};
		update();
		window.addEventListener("scroll", update, { passive: true });
		return () => window.removeEventListener("scroll", update);
	}, [groups]);

	// Keep the section being read in view in a long list.
	useEffect(() => {
		list.current
			?.querySelector('[aria-current="location"]')
			?.scrollIntoView({ block: "nearest" });
	}, [current]);

	const visible = groups
		.map((group) => ({
			...group,
			links: needle
				? group.links.filter((link) =>
						link.title.toLowerCase().includes(needle),
					)
				: group.links,
		}))
		.filter((group) => group.links.length > 0);

	return (
		<nav aria-label={label} className="flex min-h-0 flex-col">
			<label className="relative mb-2 block">
				<span className="sr-only">Search {label.toLowerCase()}</span>
				<Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder={`Search ${label.toLowerCase()}`}
					className="w-full rounded-md border border-slate-900/[0.08] bg-white/70 py-1.5 pr-2 pl-8 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-500/15"
				/>
			</label>

			<div
				ref={list}
				className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2 pb-8"
			>
				{visible.map((group) => (
					<div key={group.title} className="mt-6 first:mt-3">
						<p className="mb-1 px-2 text-[13.5px] font-semibold text-slate-900">
							{group.title}
						</p>
						<ul className="space-y-px">
							{group.links.map((link) => {
								const active = current === link.id;
								return (
									<li key={link.id}>
										<a
											href={`#${link.id}`}
											aria-current={
												active ? "location" : undefined
											}
											className={`block rounded-md px-2 py-[5px] text-[13.5px] transition-colors ${
												active
													? "bg-slate-900/[0.07] font-medium text-slate-900"
													: "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
											}`}
										>
											{link.title}
										</a>
									</li>
								);
							})}
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
