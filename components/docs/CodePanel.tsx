import type { ReactNode } from "react";
import { smokedGlass } from "@/lib/docs/theme";
import CopyButton from "./CopyButton";

const JSON_TOKEN =
	/("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;

/** Colour a pretty-printed JSON document; anything else is left as text. */
export function highlightJson(source: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let last = 0;
	for (const match of source.matchAll(JSON_TOKEN)) {
		const index = match.index ?? 0;
		if (index > last) nodes.push(source.slice(last, index));
		const [text, string, colon, number, literal] = match;
		const kind = string
			? colon
				? "key"
				: "string"
			: number
				? "number"
				: literal
					? "literal"
					: "punct";
		nodes.push(
			<span key={index} className={`tok-${kind}`}>
				{colon ? string : text}
			</span>,
		);
		if (colon) nodes.push(colon);
		last = index + text.length;
	}
	nodes.push(source.slice(last));
	return nodes;
}

export default function CodePanel({
	title,
	code,
	language = "text",
	badge,
	maxHeight,
}: {
	title: string;
	code: string;
	language?: "json" | "shell" | "text";
	badge?: ReactNode;
	maxHeight?: string;
}) {
	const body =
		language === "json" ? (
			highlightJson(code)
		) : language === "shell" ? (
			<ShellCode code={code} />
		) : (
			code
		);

	return (
		<figure
			className="docs-code overflow-hidden rounded-lg"
			style={smokedGlass}
		>
			<figcaption className="flex items-center gap-2 border-b border-white/[0.07] py-1.5 pr-1.5 pl-4">
				<span className="text-[11px] font-medium tracking-wide text-slate-300">
					{title}
				</span>
				{badge}
				<span className="ml-auto" />
				<CopyButton
					value={code}
					label={`Copy ${title.toLowerCase()}`}
				/>
			</figcaption>
			<pre
				className="docs-scroll overflow-auto px-4 py-3.5 font-mono text-[12.5px] leading-[1.65] text-slate-200"
				style={maxHeight ? { maxHeight } : undefined}
			>
				<code>{body}</code>
			</pre>
		</figure>
	);
}

function ShellCode({ code }: { code: string }) {
	return code.split(/(\{[^}]+\}|^curl\b)/gm).map((part, i) =>
		part === "curl" ? (
			<span key={i} className="tok-key">
				{part}
			</span>
		) : part.startsWith("{") ? (
			<span key={i} className="tok-param">
				{part}
			</span>
		) : (
			part
		),
	);
}
