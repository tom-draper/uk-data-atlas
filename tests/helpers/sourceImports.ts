import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const sourceFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return /\.(ts|tsx|mts)$/.test(name) ? [path] : [];
	});

const SPECIFIER =
	/(?:^|[\s;])(?:import|export)\b[^"'`;]*?\bfrom\s*["']([^"']+)["']|(?:^|[\s;])import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)/g;

/** Every module specifier a source file imports, exports from or requires. */
export const specifiers = (source: string) =>
	[...source.matchAll(SPECIFIER)].map(
		(match) => match[1] ?? match[2] ?? match[3] ?? match[4]!,
	);

/**
 * One import cycle in a directed graph, as the nodes along it with the first
 * repeated at the end, or undefined when the graph has none.
 */
export const findCycle = (
	graph: ReadonlyMap<string, readonly string[]>,
): string[] | undefined => {
	const done = new Set<string>();
	const path: string[] = [];
	const visit = (node: string): string[] | undefined => {
		const at = path.indexOf(node);
		if (at !== -1) return [...path.slice(at), node];
		if (done.has(node)) return undefined;
		path.push(node);
		for (const next of graph.get(node) ?? []) {
			const cycle = visit(next);
			if (cycle) return cycle;
		}
		path.pop();
		done.add(node);
		return undefined;
	};
	for (const node of [...graph.keys()].sort()) {
		const cycle = visit(node);
		if (cycle) return cycle;
	}
	return undefined;
};
