import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDocument } from "yaml";
import { readApiCatalogues } from "../src/catalogueLoader";
import { publicJson } from "@uk-data-atlas/atlas-runtime/storage";
import { PROBLEM_CODES } from "@uk-data-atlas/atlas-runtime/api";
import { route } from "../src/routes";

const root = resolve(import.meta.dirname, "..");
const path = resolve(root, "openapi.yaml");
const document = parseDocument(readFileSync(path, "utf8"));
const context = readApiCatalogues(root);
for (const [code, definition] of Object.entries(PROBLEM_CODES)) {
	const schema =
		code
			.split("_")
			.map((word) => word[0]!.toUpperCase() + word.slice(1))
			.join("") + "Problem";
	const response = route("GET", definition.example, context);
	if (!("code" in response.body) || response.body.code !== code)
		throw new Error(`${definition.example} did not produce ${code}`);
	document.setIn(
		["components", "schemas", schema, "examples"],
		[JSON.parse(publicJson(response.body))],
	);
}
writeFileSync(path, document.toString());
