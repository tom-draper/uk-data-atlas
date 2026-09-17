"use client";
import {
	useSyncExternalStore,
	type CSSProperties,
	type ReactNode,
} from "react";
import CopyButton from "./CopyButton";

const STORAGE_KEY = "docs-language";
const CHANGE_EVENT = "docs-language-change";

function readLanguage(): string | null {
	try {
		return window.localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

function subscribe(onChange: () => void) {
	window.addEventListener(CHANGE_EVENT, onChange);
	window.addEventListener("storage", onChange);
	return () => {
		window.removeEventListener(CHANGE_EVENT, onChange);
		window.removeEventListener("storage", onChange);
	};
}

function chooseLanguage(id: string) {
	try {
		window.localStorage.setItem(STORAGE_KEY, id);
	} catch {
		// Without storage the choice still applies to this page.
	}
	window.dispatchEvent(new Event(CHANGE_EVENT));
}

export interface CodeTab {
	id: string;
	label: string;
	code: string;
	body: ReactNode;
}

export default function CodeTabs({
	tabs,
	title,
	frameStyle,
}: {
	tabs: CodeTab[];
	title?: string;
	frameStyle: CSSProperties;
}) {
	// The server renders the first tab; the reader's choice applies once hydrated.
	const stored = useSyncExternalStore(subscribe, readLanguage, () => null);
	const active = tabs.find((tab) => tab.id === stored) ?? tabs[0];

	return (
		<figure
			className="docs-code min-w-0 overflow-hidden rounded-lg"
			style={frameStyle}
		>
			<figcaption className="flex min-h-10 items-center gap-1 border-b border-white/[0.07] pr-1.5 pl-2">
				{title && (
					<span className="mr-2 pl-2 text-[11.5px] font-medium tracking-wide text-slate-300">
						{title}
					</span>
				)}
				<div role="tablist" className="flex items-center gap-0.5">
					{tabs.map((tab) => {
						const selected = tab.id === active.id;
						return (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={selected}
								onClick={() => chooseLanguage(tab.id)}
								className={`relative cursor-pointer rounded-md px-2.5 py-1 text-[12px] transition-colors ${
									selected
										? "bg-white/10 text-white"
										: "text-slate-400 hover:text-slate-200"
								}`}
							>
								{tab.label}
							</button>
						);
					})}
				</div>
				<span className="ml-auto" />
				<CopyButton
					value={active.code}
					label={`Copy ${active.label}`}
				/>
			</figcaption>
			<div role="tabpanel">{active.body}</div>
		</figure>
	);
}
