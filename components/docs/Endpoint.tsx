import type { HttpMethod } from "@/lib/docs/openapi";

const METHOD_STYLES: Record<HttpMethod, string> = {
	get: "bg-emerald-500/12 text-emerald-700 ring-emerald-600/20",
	head: "bg-slate-500/10 text-slate-600 ring-slate-500/20",
	post: "bg-slate-500/10 text-slate-700 ring-slate-500/20",
	put: "bg-amber-500/12 text-amber-700 ring-amber-600/20",
	patch: "bg-amber-500/12 text-amber-700 ring-amber-600/20",
	delete: "bg-rose-500/12 text-rose-700 ring-rose-600/20",
};

export function MethodBadge({
	method,
	size = "md",
}: {
	method: HttpMethod;
	size?: "sm" | "md";
}) {
	const sizing =
		size === "sm"
			? "min-w-[34px] px-1 py-px text-[9px]"
			: "min-w-[42px] px-1.5 py-0.5 text-[11px]";
	return (
		<span
			className={`inline-flex shrink-0 items-center justify-center rounded-[4px] font-mono font-semibold uppercase tracking-wide ring-1 ring-inset ${sizing} ${METHOD_STYLES[method]}`}
		>
			{method}
		</span>
	);
}

/** A route with its `{parameters}` picked out. */
export function EndpointPath({
	path,
	className = "",
	dimPrefix,
}: {
	path: string;
	className?: string;
	/** A leading part to fade, e.g. the resource a tree row sits under. */
	dimPrefix?: string;
}) {
	const prefix = dimPrefix && path.startsWith(dimPrefix) ? dimPrefix : "";
	const rest = path.slice(prefix.length);
	return (
		<code className={`font-mono break-all ${className}`}>
			{prefix && <span className="text-slate-400">{prefix}</span>}
			{rest.split(/(\{[^}]+\})/g).map((part, i) =>
				part.startsWith("{") ? (
					<span key={i} className="text-slate-600">
						{part}
					</span>
				) : (
					<span key={i}>{part}</span>
				),
			)}
		</code>
	);
}
