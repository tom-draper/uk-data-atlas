import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderOpenapi } from "../src/contract/renderOpenapi";

const file = fileURLToPath(new URL("../openapi.yaml", import.meta.url));
const source = readFileSync(file, "utf8");
const output = await renderOpenapi(source);
if (process.argv.includes("--check")) {
	if (source !== output) {
		console.error(
			"openapi.yaml is stale. Run pnpm --dir services/api generate:openapi.",
		);
		process.exitCode = 1;
	}
} else {
	writeFileSync(file, output);
}
