import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export const INDEX_START = "<!-- route-index:start -->";
export const INDEX_END = "<!-- route-index:end -->";

type Spec = {
	tags: Array<{ name: string; description?: string }>;
	paths: Record<string, { get?: { tags?: string[]; summary?: string } }>;
};

/**
 * The route index as the OpenAPI document defines it, grouped by the task tag
 * each operation carries. It is generated rather than maintained, so the
 * README cannot become a second inventory that drifts from the contract.
 */
export const renderRouteIndex = (spec: Spec) => {
	const lines = [INDEX_START, ""];
	for (const tag of spec.tags) {
		const operations = Object.entries(spec.paths).flatMap(([path, item]) =>
			item.get?.tags?.includes(tag.name)
				? [
						[
							path === "/" ? "/v1" : `/v1${path}`,
							item.get.summary,
						] as const,
					]
				: [],
		);
		if (operations.length === 0) continue;
		lines.push(`**${tag.name}**`, "");
		for (const [path, summary] of operations)
			lines.push(`- \`GET ${path}\`${summary ? ` — ${summary}` : ""}`);
		lines.push("");
	}
	return [...lines, INDEX_END].join("\n");
};

export const readSpec = (apiRoot: string) =>
	parse(readFileSync(resolve(apiRoot, "openapi.yaml"), "utf8")) as Spec;

export const buildReadmeIndex = (apiRoot: string) => {
	const readmePath = resolve(apiRoot, "README.md");
	const readme = readFileSync(readmePath, "utf8");
	const start = readme.indexOf(INDEX_START);
	const end = readme.indexOf(INDEX_END);
	if (start === -1 || end === -1) {
		throw new Error(`README.md has no ${INDEX_START} … ${INDEX_END} block`);
	}
	const rendered = renderRouteIndex(readSpec(apiRoot));
	const updated =
		readme.slice(0, start) +
		rendered +
		readme.slice(end + INDEX_END.length);
	writeFileSync(readmePath, updated);
	return { readmePath, changed: updated !== readme };
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const apiRoot = resolve(dirname(scriptPath), "..");
	const { readmePath, changed } = buildReadmeIndex(apiRoot);
	console.log(
		changed
			? `Wrote the route index to ${readmePath}`
			: `The route index in ${readmePath} was already current`,
	);
}
