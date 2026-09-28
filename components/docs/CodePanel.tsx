import type { ReactNode } from "react";
import type { CodeSample } from "@/lib/docs/samples";
import { inkPanel } from "@/lib/docs/theme";
import CodeTabs from "./CodeTabs";
import CopyButton from "./CopyButton";
import { highlight, type CodeLanguage } from "./highlight";

function Frame({
	header,
	children,
}: {
	header: ReactNode;
	children: ReactNode;
}) {
	return (
		<figure
			className="docs-code min-w-0 overflow-hidden rounded-md"
			style={inkPanel}
		>
			<figcaption className="flex min-h-10 items-center gap-2 border-b border-white/[0.07] pr-1.5 pl-4">
				{header}
			</figcaption>
			{children}
		</figure>
	);
}

function Body({ code, maxHeight }: { code: ReactNode; maxHeight?: string }) {
	return (
		<pre
			className="docs-scroll overflow-auto px-4 py-3.5 font-mono text-[12.5px] leading-[1.7] text-slate-200"
			style={maxHeight ? { maxHeight } : undefined}
		>
			<code>{code}</code>
		</pre>
	);
}

/** One block of code in the atlas's smoked glass. */
export default function CodePanel({
	title,
	code,
	language = "text",
	badge,
	maxHeight,
}: {
	title: string;
	code: string;
	language?: CodeLanguage;
	badge?: ReactNode;
	maxHeight?: string;
}) {
	return (
		<Frame
			header={
				<>
					<span className="text-[11.5px] font-medium tracking-wide text-slate-300">
						{title}
					</span>
					{badge}
					<span className="ml-auto" />
					<CopyButton
						value={code}
						label={`Copy ${title.toLowerCase()}`}
					/>
				</>
			}
		>
			<Body code={highlight(code, language)} maxHeight={maxHeight} />
		</Frame>
	);
}

/**
 * The same request in each language, with the reader's language remembered
 * across every sample on the site. Highlighting happens here on the server;
 * only the choice of tab runs in the browser.
 */
export function RequestSamples({
	samples,
	title,
	maxHeight,
}: {
	samples: CodeSample[];
	title?: string;
	maxHeight?: string;
}) {
	return (
		<CodeTabs
			title={title}
			tabs={samples.map((sample) => ({
				id: sample.language,
				label: sample.label,
				code: sample.code,
				body: (
					<Body
						code={highlight(sample.code, sample.language)}
						maxHeight={maxHeight}
					/>
				),
			}))}
			frameStyle={inkPanel}
		/>
	);
}
