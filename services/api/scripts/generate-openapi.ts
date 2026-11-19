import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderOpenapi } from "../src/contract/renderOpenapi";

const base = fileURLToPath(new URL("../openapi.base.yaml", import.meta.url));
const file = fileURLToPath(new URL("../openapi.yaml", import.meta.url));
const output = await renderOpenapi(readFileSync(base, "utf8"));
if (process.argv.includes("--check")) {
	if (readFileSync(file, "utf8") !== output) {
		console.error(
			"openapi.yaml is stale. Run pnpm --dir services/api generate:openapi.",
		);
		process.exitCode = 1;
	}
} else {
	writeFileSync(file, output);
}
