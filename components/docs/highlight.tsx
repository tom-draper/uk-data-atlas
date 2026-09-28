import type { ReactNode } from "react";

export type CodeLanguage =
	"json" | "curl" | "shell" | "javascript" | "python" | "text";

type Rule = [kind: string, pattern: RegExp];

const JSON_RULES: Rule[] = [
	["key", /"(?:[^"\\]|\\.)*"(?=\s*:)/y],
	["string", /"(?:[^"\\]|\\.)*"/y],
	["number", /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y],
	["literal", /\b(?:true|false|null)\b/y],
	["punct", /[{}[\],:]/y],
];

const SHELL_RULES: Rule[] = [
	["comment", /#.*/y],
	["key", /\b(?:curl)\b/y],
	["string", /"(?:[^"\\]|\\.)*"/y],
	["param", /\{[^}\s]+\}/y],
];

const JAVASCRIPT_RULES: Rule[] = [
	["comment", /\/\/.*/y],
	["string", /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/y],
	[
		"key",
		/\b(?:const|let|await|async|function|return|if|else|while|for|of|new|throw|import|from|export)\b/y,
	],
	["literal", /\b(?:true|false|null|undefined)\b/y],
	["number", /\b\d+(?:\.\d+)?\b/y],
	["fn", /\b[A-Za-z_]\w*(?=\()/y],
];

const PYTHON_RULES: Rule[] = [
	["comment", /#.*/y],
	["string", /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y],
	[
		"key",
		/\b(?:import|from|as|def|return|if|else|elif|while|for|in|not|and|or|with|raise|break)\b/y,
	],
	["literal", /\b(?:True|False|None)\b/y],
	["number", /\b\d+(?:\.\d+)?\b/y],
	["fn", /\b[A-Za-z_]\w*(?=\()/y],
];

const RULES: Record<CodeLanguage, Rule[]> = {
	json: JSON_RULES,
	curl: SHELL_RULES,
	shell: SHELL_RULES,
	javascript: JAVASCRIPT_RULES,
	python: PYTHON_RULES,
	text: [],
};

/** Colour code for the smoked-glass panels; unknown text passes through. */
export function highlight(code: string, language: CodeLanguage): ReactNode[] {
	const rules = RULES[language];
	const nodes: ReactNode[] = [];
	let plain = "";
	let index = 0;

	while (index < code.length) {
		let matched = false;
		// Only start a token at a word boundary, so `data1` is not a number.
		const boundary = index === 0 || /\W/.test(code[index - 1]);
		for (const [kind, pattern] of rules) {
			if (!boundary && /^\\b/.test(pattern.source)) continue;
			pattern.lastIndex = index;
			const match = pattern.exec(code);
			if (!match || match[0].length === 0) continue;
			if (plain) nodes.push(plain);
			plain = "";
			nodes.push(
				<span key={index} className={`tok-${kind}`}>
					{match[0]}
				</span>,
			);
			index += match[0].length;
			matched = true;
			break;
		}
		if (!matched) {
			plain += code[index];
			index += 1;
		}
	}
	if (plain) nodes.push(plain);
	return nodes;
}
