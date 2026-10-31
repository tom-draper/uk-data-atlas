import { parseDocument, stringify } from "yaml";
import { generatedPaths } from "./generatedRoutes";
import { generatedComponents } from "./generatedComponents";

export const renderOpenapi = async (source: string) => {
	const document = parseDocument(source);
	if (document.errors.length) throw document.errors[0];
	let output = source;
	for (const [path, item] of Object.entries(await generatedPaths())) {
		if (!document.hasIn(["paths", path]))
			throw new Error(`Missing path: ${path}`);
		const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const pattern = new RegExp(
			`^  ${escaped}:\\n[\\s\\S]*?(?=^  /|^components:)`,
			"m",
		);
		if (!pattern.test(output))
			throw new Error(`Cannot replace path: ${path}`);
		const fragment = stringify({ [path]: item }, { lineWidth: 100 })
			.trimEnd()
			.split("\n")
			.map((line) => (line.trim() ? `  ${line}` : ""))
			.join("\n");
		output = output.replace(pattern, () => `${fragment}\n\n`);
	}
	const schemasPattern =
		/^  schemas:\n[\s\S]*?(?=^  [^ \r\n]|^[^ \r\n]|$(?![\s\S]))/m;
	const schemasBlock = output.match(schemasPattern)?.[0];
	if (!schemasBlock) throw new Error("Cannot find component schemas");
	let updatedSchemas = schemasBlock;
	for (const [name, schema] of Object.entries(generatedComponents())) {
		if (!document.hasIn(["components", "schemas", name]))
			throw new Error(`Missing schema: ${name}`);
		const pattern = new RegExp(
			`^    ${name}:\\n[\\s\\S]*?(?=^    [^ ]|$(?![\\s\\S]))`,
			"m",
		);
		if (!pattern.test(updatedSchemas))
			throw new Error(`Cannot replace schema: ${name}`);
		const fragment = stringify({ [name]: schema }, { lineWidth: 100 })
			.trimEnd()
			.split("\n")
			.map((line) => (line.trim() ? `    ${line}` : ""))
			.join("\n");
		updatedSchemas = updatedSchemas.replace(
			pattern,
			() => `${fragment}\n\n`,
		);
	}
	return output.replace(schemasPattern, () => updatedSchemas);
};
