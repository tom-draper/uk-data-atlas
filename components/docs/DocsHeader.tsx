"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { glassPane } from "@/lib/docs/theme";
import DocsSidebar, { type SidebarSection } from "./DocsSidebar";

export default function DocsHeader({
	sections,
	version,
	preview,
}: {
	sections: SidebarSection[];
	version: string;
	preview: boolean;
}) {
	const pathname = usePathname();
	const [menuPath, setMenuPath] = useState<string | null>(null);
	// The menu belongs to the page it was opened on, so navigating closes it.
	const menuOpen = menuPath === pathname;

	return (
		<header className="docs-header-veil sticky top-0 z-30 px-3 pt-3 sm:px-4">
			<div
				className="relative mx-auto flex h-12 max-w-[1480px] items-center gap-3 rounded-xl px-3 sm:px-4"
				style={glassPane}
			>
				<button
					type="button"
					onClick={() => setMenuPath(menuOpen ? null : pathname)}
					aria-expanded={menuOpen}
					aria-label={menuOpen ? "Close menu" : "Open menu"}
					className="-ml-1 cursor-pointer rounded-md p-1.5 text-slate-600 hover:bg-white/50 lg:hidden"
				>
					{menuOpen ? (
						<X className="h-4 w-4" />
					) : (
						<Menu className="h-4 w-4" />
					)}
				</button>

				<Link href="/" className="flex items-center gap-2">
					<span className="text-[15px] font-semibold tracking-tight text-slate-900">
						UK Data Atlas
					</span>
				</Link>
				<span className="h-4 w-px bg-slate-900/10" aria-hidden />
				<Link
					href="/docs"
					className="text-[14px] font-medium text-slate-600 hover:text-slate-900"
				>
					API
				</Link>
				<span className="hidden rounded-full bg-white/60 px-2 py-0.5 font-mono text-[11px] text-slate-500 ring-1 ring-slate-900/5 sm:inline">
					v{version}
				</span>
				{preview && (
					<span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-600/20">
						Preview
					</span>
				)}

				<nav className="ml-auto flex items-center gap-1 text-[13px]">
					<Link
						href="/atlas"
						className="rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-white/50 hover:text-slate-900"
					>
						Atlas
					</Link>
					<Link
						href="/sources"
						className="hidden rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-white/50 hover:text-slate-900 sm:block"
					>
						Sources
					</Link>
				</nav>
			</div>

			{menuOpen && (
				<div
					className="absolute inset-x-3 top-[64px] flex max-h-[calc(100dvh-80px)] flex-col overflow-hidden rounded-xl sm:inset-x-4 lg:hidden"
					style={{
						...glassPane,
						background:
							"linear-gradient(160deg, rgba(255,255,255,0.8) 0%, rgba(246,248,252,0.72) 100%)",
					}}
				>
					<DocsSidebar
						sections={sections}
						onNavigate={() => setMenuPath(null)}
					/>
				</div>
			)}
		</header>
	);
}
