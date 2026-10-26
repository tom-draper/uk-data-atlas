import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.ts";
import { tools } from "../src/tools.ts";
import { envelope, mockApi, params } from "./helpers.ts";

async function connect(api = mockApi()) {
	const { server } = createServer({ client: api.client });
	const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "test", version: "0.0.0" });
	await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
	return { client, requests: api.requests };
}

describe("MCP server", () => {
	it("lists every tool as read only, with a description", async () => {
		const { client } = await connect();
		const { tools: listed } = await client.listTools();
		assert.deepEqual(
			listed.map((tool) => tool.name).sort(),
			tools.map((tool) => tool.name).sort(),
		);
		assert.ok(listed.length >= 6 && listed.length <= 8);
		for (const tool of listed) {
			assert.ok(tool.description!.length > 80, tool.name);
			assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
		}
	});

	it("calls a tool end to end through the protocol", async () => {
		const { client, requests } = await connect(
			mockApi({ body: envelope({ query: "Leeds", candidates: [] }) }),
		);
		const result = await client.callTool({
			name: "find_place",
			arguments: { q: "Leeds" },
		});
		assert.deepEqual(params(requests[0]!), { q: "Leeds" });
		const content = result.content as { text: string }[];
		assert.match(content[0]!.text, /"candidates":\[\]/);
	});

	it("rejects arguments that break a tool's schema before any request", async () => {
		const { client, requests } = await connect();
		const result = await client
			.callTool({ name: "find_place", arguments: { q: "" } })
			.catch((error) => error);
		const failed = result instanceof Error || result.isError === true;
		assert.ok(failed);
		assert.equal(requests.length, 0);
	});
});
