"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export type NavMenuLink = { href: string; label: string };

/** A nav item that opens a short list of links, for keyboard, mouse and touch. */
export default function NavMenu({
	label,
	links,
	buttonClass,
}: {
	label: string;
	links: NavMenuLink[];
	buttonClass: string;
}) {
	const [open, setOpen] = useState(false);
	const root = useRef<HTMLDivElement>(null);
	const button = useRef<HTMLButtonElement>(null);
	const menuId = useId();

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setOpen(false);
			button.current?.focus();
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	return (
		<div
			ref={root}
			className="relative"
			onBlur={(event) => {
				// Tabbing out of the menu closes it.
				if (!root.current?.contains(event.relatedTarget))
					setOpen(false);
			}}
		>
			<button
				ref={button}
				type="button"
				aria-expanded={open}
				aria-controls={menuId}
				onClick={() => setOpen((value) => !value)}
				className={`inline-flex cursor-pointer items-center gap-1 ${buttonClass}`}
			>
				{label}
				<ChevronDown
					aria-hidden
					className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			<ul
				id={menuId}
				hidden={!open}
				className="absolute top-full left-0 z-30 mt-1 min-w-40 rounded-md border border-slate-900/10 bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)] sm:right-0 sm:left-auto"
			>
				{links.map((link) => (
					<li key={link.href}>
						<Link
							href={link.href}
							onClick={() => setOpen(false)}
							className="block px-3 py-2 text-left text-[14px] whitespace-nowrap text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
						>
							{link.label}
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
