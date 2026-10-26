import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DEFAULT_BASE_URL } from "./client.ts";
import { createServer } from "./server.ts";

// stdout carries the protocol, so anything for a human goes to stderr.
const baseUrl = process.env.UK_DATA_ATLAS_API_URL || DEFAULT_BASE_URL;
const { server } = createServer({ baseUrl });
await server.connect(new StdioServerTransport());
console.error(`uk-data-atlas MCP server ready, reading from ${baseUrl}`);
