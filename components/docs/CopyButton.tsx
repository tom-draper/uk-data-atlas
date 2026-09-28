"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyButton({
	value,
	label = "Copy",
	tone = "dark",
}: {
	value: string;
	label?: string;
	tone?: "dark" | "light";
}) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch {
			// Clipboard access can be refused; the text stays selectable.
		}
	}

	const colours =
		tone === "dark"
			? "text-slate-400 hover:bg-white/10 hover:text-slate-100"
			: "text-slate-500 hover:bg-white/70 hover:text-slate-800";

	return (
		<button
			type="button"
			onClick={copy}
			aria-label={copied ? "Copied" : label}
			title={copied ? "Copied" : label}
			className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors ${colours}`}
		>
			{copied ? (
				<Check className="h-3.5 w-3.5" />
			) : (
				<Copy className="h-3.5 w-3.5" />
			)}
		</button>
	);
}
