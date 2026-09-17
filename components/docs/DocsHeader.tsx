"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { glassPane } from "@/lib/docs/theme";
import type { NavGroup } from "@/lib/docs/navigation";
import GlassOverlays from "../GlassOverlays";
import DocsSidebar from "./DocsSidebar";

export default function DocsHeader({
	groups,
	version,
}: {
	groups: NavGroup[];
	version: string;
}) {
	const pathname = usePathname();
	const [menuPath, setMenuPath] = useState<string | null>(null);
	// The menu belongs to the page it was opened on, so navigating closes it.
	const menuOpen = menuPath === pathname;

	return (
		<header className="sticky top-0 z-30 px-3 pt-3 sm:px-4">
			<div
				className="relative mx-auto max-w-[calc(1480px-1.5rem)] overflow-hidden rounded-md sm:max-w-[calc(1480px-2rem)]"
				style={glassPane}
			>
				<GlassOverlays isDark={false} />
				<div className="relative z-10 flex h-9 items-center gap-3 px-3 sm:pr-4 sm:pl-0">
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

					<Link href="/" className="-mr-3 hidden shrink-0 sm:block">
						<Image
							src="/union-jack.png"
							alt=""
							width={72}
							height={36}
							className="-m-px mr-3 h-9 rounded-r-md opacity-60 scale-x-[-1]"
							style={{
								filter: "contrast(0.2) grayscale(1) brightness(1.8)",
							}}
						/>
					</Link>
					<Link href="/" className="flex shrink-0 items-center">
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

					<nav className="ml-auto flex items-center gap-1 text-[13px]">
						<HeaderLink
							href="/docs/guides/map"
							active={pathname.startsWith("/docs/guides")}
							className="hidden md:block"
						>
							Guides
						</HeaderLink>
						<HeaderLink
							href="/docs/reference"
							active={pathname.startsWith("/docs/reference")}
							className="hidden sm:block"
						>
							API reference
						</HeaderLink>
					</nav>
				</div>
			</div>

			{menuOpen && (
				<div
					className="absolute inset-x-3 top-[52px] flex max-h-[calc(100dvh-68px)] flex-col overflow-hidden rounded-md sm:inset-x-4 lg:hidden"
					style={glassPane}
				>
					<GlassOverlays isDark={false} />
					<div className="relative z-10 flex min-h-0 flex-1 flex-col">
						<DocsSidebar
							groups={groups}
							onNavigate={() => setMenuPath(null)}
						/>
					</div>
				</div>
			)}
		</header>
	);
}

function HeaderLink({
	href,
	active = false,
	className = "",
	children,
}: {
	href: string;
	active?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			className={`rounded-md px-2.5 py-1.5 transition-colors ${
				active
					? "bg-white/60 text-slate-900"
					: "text-slate-600 hover:bg-white/50 hover:text-slate-900"
			} ${className}`}
		>
			{children}
		</Link>
	);
}
