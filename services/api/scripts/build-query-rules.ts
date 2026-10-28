import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { compileQueryRules } from "@uk-data-atlas/atlas-runtime/api";

/**
 * Writes `src/queryRules.ts` from `openapi.yaml`. The file is committed, so
 * handlers get each rule's values as types; a test fails when it no longer
 * matches the document, and running this brings it back in step.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rules = compileQueryRules(
	parse(readFileSync(join(apiRoot, "openapi.yaml"), "utf8")),
);
const outputPath = join(apiRoot, "src", "queryRules.ts");
writeFileSync(
	outputPath,
	[
		"// Generated from openapi.yaml by `pnpm --dir services/api generate:query-rules`. Do not edit.",
		"",
		`export const QUERY_RULES = ${JSON.stringify(rules, null, "\t")} as const;`,
		"",
	].join("\n"),
);
execFileSync("pnpm", ["exec", "prettier", "--write", outputPath], {
	stdio: "ignore",
});
console.log(
	`Wrote query rules for ${Object.keys(rules).length} operations to ${outputPath}`,
);
