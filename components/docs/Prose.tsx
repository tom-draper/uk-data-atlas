import { Fragment, type ReactNode } from "react";
import { paragraphs } from "@/lib/docs/openapi";

/**
 * The spec's descriptions use only paragraphs, `code` and **bold**, so this
 * renders exactly those rather than pulling in a Markdown parser.
 */
export function Inline({ text }: { text: string }) {
	const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
	return parts.map((part, i): ReactNode => {
		if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
			return (
				<code
					key={i}
					className="rounded-[4px] border border-slate-900/[0.06] bg-white/70 px-[0.35em] py-[0.1em] font-mono text-[0.86em] text-slate-800"
				>
					{part.slice(1, -1)}
				</code>
			);
		}
		if (part.startsWith("**") && part.endsWith("**") && part.length > 3) {
			return (
				<strong key={i} className="font-semibold text-slate-900">
					{part.slice(2, -2)}
				</strong>
			);
		}
		return <Fragment key={i}>{part}</Fragment>;
	});
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

/** The first sentence of a description, for summaries and meta tags. */
export function firstSentence(text: string, maxLength = 160): string {
	const flat = paragraphs(text)[0]?.replace(/[`*]/g, "") ?? "";
	const sentence = flat.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? flat;
	return sentence.length > maxLength
		? `${sentence.slice(0, maxLength - 1).trimEnd()}…`
		: sentence;
}

const LONG_DESCRIPTION = 600;

/**
 * An operation's description. A long one opens with its first sentence and
 * folds the rest, so the parameters stay within reach; the folded text is
 * still in the page for readers and search engines.
 */
export function Description({ text }: { text: string }) {
	const [first = "", ...rest] = paragraphs(text);
	if (text.length <= LONG_DESCRIPTION) return <Prose text={text} />;

	const lead = first.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? first;
	const remainder = [first.slice(lead.length).trim(), ...rest]
		.filter(Boolean)
		.join("\n\n");

	return (
		<div>
			<p className="text-[16px] leading-[1.7] text-slate-700">
				<Inline text={lead} />
			</p>
			{remainder && (
				<details className="docs-description group mt-3">
					<summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-slate-900/[0.08] bg-white/55 px-3 py-1 text-[13px] text-slate-600 select-none hover:bg-white/80 hover:text-slate-900">
						<span className="group-open:hidden">
							Read the full description
						</span>
						<span className="hidden group-open:inline">
							Show less
						</span>
					</summary>
					<Prose text={remainder} className="mt-4" />
				</details>
			)}
		</div>
	);
}
