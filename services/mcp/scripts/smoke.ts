import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { DEFAULT_BASE_URL } from "../src/client.ts";

/**
 * Optional smoke test: `pnpm --dir services/mcp smoke [api-base-url]`.
 *
 * Starts the real server over stdio and asks a running API a few questions
 * through it. It needs a reachable API (by default the one at
 * UK_DATA_ATLAS_API_URL, else production) and is not part of `pnpm check`.
 * Exit status is 0 when the API answered every call, 2 when it is unreachable.
 */
const baseUrl =
	process.argv[2] || process.env.UK_DATA_ATLAS_API_URL || DEFAULT_BASE_URL;

try {
	await fetch(`${baseUrl}/atlas-release`, {
		signal: AbortSignal.timeout(5000),
	});
} catch {
	console.error(
		`No API answering at ${baseUrl}. Start one, or pass its URL.`,
	);
	process.exit(2);
}

const transport = new StdioClientTransport({
	command: process.execPath,
	args: [
		"--import",
		"tsx",
		fileURLToPath(new URL("../src/cli.ts", import.meta.url)),
	],
	cwd: fileURLToPath(new URL("..", import.meta.url)),
	env: { ...process.env, UK_DATA_ATLAS_API_URL: baseUrl } as Record<
		string,
		string
	>,
	stderr: "inherit",
});
const client = new Client({ name: "uk-data-atlas-smoke", version: "0.0.0" });
await client.connect(transport);

const calls: [string, Record<string, unknown>][] = [
	["find_place", { q: "Manchester" }],
	["find_measures", { q: "population" }],
	["get_value", { measure: "population", place: "North Wales" }],
	["locate", { postcode: "SW1A 1AA" }],
	["boundary_releases", { geography: "ward" }],
];

let failed = 0;
for (const [name, args] of calls) {
	const result = await client.callTool({ name, arguments: args });
	const text = (result.content as { text: string }[])[0]?.text ?? "";
	const ok = !result.isError;
	if (!ok) failed++;
	console.log(`${ok ? "ok  " : "FAIL"} ${name} ${JSON.stringify(args)}`);
	console.log(`     ${text.slice(0, 160).replace(/\n/g, " ")}`);
}
await client.close();
process.exit(failed ? 1 : 0);
