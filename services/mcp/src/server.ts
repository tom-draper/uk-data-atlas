import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type ApiClient, type ClientOptions } from "./client.ts";
import { tools } from "./tools.ts";

const INSTRUCTIONS =
	"Answers UK place questions from the UK Data Atlas API instead of from memory. Resolve names with " +
	"find_place and measures with find_measures, then ask get_value, get_series, locate, get_area, " +
	"convert_code or boundary_releases. Place names are often ambiguous: never choose between candidates " +
	"silently. When quoting a figure, state the period, the method and anything the API defaulted, and " +
	"credit the source (the Office for National Statistics and other publishers named in the reply). " +
	"If the API refuses or finds nothing, say so rather than estimating.";

export function createServer(
	options: ClientOptions | { client: ApiClient } = {},
) {
	const client = "client" in options ? options.client : createClient(options);
	const server = new McpServer(
		{ name: "uk-data-atlas", version: "0.0.0" },
		{ instructions: INSTRUCTIONS },
	);
	for (const tool of tools) {
		server.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: tool.inputSchema,
				annotations: {
					readOnlyHint: true,
					destructiveHint: false,
					idempotentHint: true,
					openWorldHint: true,
				},
			},
			// The SDK validates the arguments against `inputSchema` first.
			(args: any) => tool.run(args, client),
		);
	}
	return { server, client };
}
