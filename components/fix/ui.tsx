import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";
import type { Tone } from "@/lib/fix/diagnose";

/** Shared pieces for the fix page, in the slate look of /places and /datasets. */

export function Button({
	variant = "secondary",
	className = "",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary";
}) {
	const look =
		variant === "primary"
			? "bg-slate-900 text-white hover:bg-slate-700 disabled:bg-slate-400"
			: "border border-slate-900/10 bg-white text-slate-800 hover:border-slate-900/25 hover:bg-slate-50 disabled:text-slate-400";
	return (
		<button
			type="button"
			className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-[14px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed ${look} ${className}`}
			{...props}
		/>
	);
}

export function StepHeading({
	step,
	id,
	children,
	aside,
}: {
	step: number;
	id: string;
	children: ReactNode;
	aside?: ReactNode;
}) {
	return (
		<div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<h2
				id={id}
				className="flex items-baseline gap-2.5 text-[19px] font-semibold tracking-tight text-slate-900"
			>
				<span className="text-[14px] font-medium text-slate-400 tabular-nums">
					{step}.
				</span>
				{children}
			</h2>
			{aside && (
				<span className="text-[13px] text-slate-500">{aside}</span>
			)}
		</div>
	);
}

const TONES: Record<
	Tone,
	{ label: string; icon: typeof Info; className: string }
> = {
	ok: { label: "OK", icon: CircleCheck, className: "text-emerald-700" },
	warn: { label: "Warning", icon: CircleAlert, className: "text-amber-700" },
	error: { label: "Problem", icon: CircleX, className: "text-rose-700" },
	info: { label: "Note", icon: Info, className: "text-slate-500" },
};

/** A status shown by shape and a spoken word, not by colour alone. */
export function ToneIcon({ tone }: { tone: Tone }) {
	const { label, icon: Icon, className } = TONES[tone];
	return (
		<>
			<Icon
				aria-hidden="true"
				className={`mt-[3px] h-[18px] w-[18px] shrink-0 ${className}`}
			/>
			<span className="sr-only">{label}: </span>
		</>
	);
}

export const selectClass =
	"min-h-10 w-full rounded-md border border-slate-900/15 bg-white px-3 py-2 text-[14px] text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900";

export const labelClass = "mb-1 block text-[13px] font-medium text-slate-600";
