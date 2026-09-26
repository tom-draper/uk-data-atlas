import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { paragraphs } from "@/lib/docs/openapi";

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

/**
 * Inline text for the docs: `code`, **bold** and [links](/docs/...). That is
 * all the spec's descriptions and the written content use, so it is rendered
 * directly rather than through a Markdown parser.
 */
export function Inline({ text }: { text: string }) {
	return text.split(INLINE).map((part, i): ReactNode => {
		if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
			return <Code key={i}>{part.slice(1, -1)}</Code>;
		}
		if (part.startsWith("**") && part.endsWith("**") && part.length > 3) {
			return (
				<strong key={i} className="font-semibold text-slate-900">
					{part.slice(2, -2)}
				</strong>
			);
		}
		const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
		if (link) {
			return (
				<TextLink key={i} href={link[2]}>
					<Inline text={link[1]} />
				</TextLink>
			);
		}
		return <Fragment key={i}>{part}</Fragment>;
	});
}

export function Code({ children }: { children: ReactNode }) {
	return (
		<code className="rounded-[4px] border border-slate-900/[0.06] bg-white/70 px-[0.35em] py-[0.1em] font-mono text-[0.86em] text-slate-800">
			{children}
		</code>
	);
}

export function TextLink({
	href,
	children,
}: {
	href: string;
	children: ReactNode;
}) {
	return (
		<Link
			href={href}
			className="font-medium text-slate-800 underline decoration-slate-400 underline-offset-[3px] hover:decoration-slate-700"
		>
			{children}
		</Link>
	);
}

export default function Prose({
	text,
	className = "",
}: {
	text: string;
	className?: string;
}) {
	return (
		<div
			className={`space-y-3 text-[15px] leading-[1.7] text-slate-600 ${className}`}
		>
			{paragraphs(text).map((paragraph, i) => (
				<p key={i}>
					<Inline text={paragraph} />
				</p>
			))}
		</div>
	);
}
