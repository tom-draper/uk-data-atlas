import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { paperCard } from "@/lib/docs/theme";

export function Sheet({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={`px-1 pt-6 pb-10 sm:px-6 lg:px-10 ${className}`}>
			{children}
		</div>
	);
}

export function Card({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={`rounded-xl ${className}`} style={paperCard}>
			{children}
		</div>
	);
}

export function Breadcrumbs({
	trail,
}: {
	trail: { label: string; href?: string }[];
}) {
	return (
		<nav
			aria-label="Breadcrumb"
			className="mb-5 flex flex-wrap items-center gap-1 text-[13px] text-slate-500"
		>
			{trail.map((crumb, i) => (
				<span key={crumb.label} className="flex items-center gap-1">
					{i > 0 && (
						<ChevronRight className="h-3 w-3 text-slate-400" />
					)}
					{crumb.href ? (
						<Link
							href={crumb.href}
							className="hover:text-slate-900"
						>
							{crumb.label}
						</Link>
					) : (
						<span className="text-slate-700">{crumb.label}</span>
					)}
				</span>
			))}
		</nav>
	);
}

export function Eyebrow({ children }: { children: ReactNode }) {
	return (
		<p className="mb-2 text-[14px] font-medium text-indigo-600">
			{children}
		</p>
	);
}

export function SectionHeading({
	id,
	children,
	aside,
}: {
	id: string;
	children: ReactNode;
	aside?: ReactNode;
}) {
	return (
		<div className="mb-4 flex items-baseline gap-3 border-b border-slate-900/[0.07] pb-2.5">
			<h2
				id={id}
				className="scroll-mt-24 text-[19px] font-semibold tracking-tight text-slate-900"
			>
				<a href={`#${id}`} className="hover:underline">
					{children}
				</a>
			</h2>
			{aside && (
				<span className="text-[13px] text-slate-500">{aside}</span>
			)}
		</div>
	);
}

export function Pill({
	children,
	tone = "slate",
}: {
	children: ReactNode;
	tone?: "slate" | "indigo" | "amber" | "rose" | "emerald";
}) {
	const tones = {
		slate: "bg-white/60 text-slate-600 ring-slate-900/[0.08]",
		indigo: "bg-indigo-500/10 text-indigo-700 ring-indigo-600/15",
		amber: "bg-amber-400/15 text-amber-800 ring-amber-600/20",
		rose: "bg-rose-500/10 text-rose-700 ring-rose-600/15",
		emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/15",
	};
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${tones[tone]}`}
		>
			{children}
		</span>
	);
}

export function statusTone(status: string): "emerald" | "amber" | "rose" {
	if (status.startsWith("2")) return "emerald";
	if (status.startsWith("3")) return "amber";
	return "rose";
}
