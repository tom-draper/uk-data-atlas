import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildUrl, createClient, DEFAULT_BASE_URL } from "../src/client.ts";
import { MAX_CHARS, success } from "../src/result.ts";
import { BASE, envelope, mockApi } from "./helpers.ts";

describe("buildUrl", () => {
	it("drops empty values and joins lists with commas", () => {
		assert.equal(
			buildUrl(BASE, "/x", {
				a: "1",
				b: undefined,
				c: "",
				d: ["w", "l"],
				e: [],
				f: 0,
				g: false,
			}),
			`${BASE}/x?a=1&d=w%2Cl&f=0&g=false`,
		);
	});
});

describe("client", () => {
	it("defaults to the production API and trims a trailing slash", () => {
		assert.equal(createClient().baseUrl, DEFAULT_BASE_URL);
		assert.equal(DEFAULT_BASE_URL, "https://api.ukdataatlas.com/v1");
		assert.equal(
			createClient({ baseUrl: "http://127.0.0.1:3001/v1/" }).baseUrl,
			"http://127.0.0.1:3001/v1",
		);
	});

	it("sends only a GET asking for JSON, with no credentials", async () => {
		const { client, requests } = mockApi();
		await client.get("/measures");
		const init = requests[0]!.init!;
		assert.equal(init.method, "GET");
		assert.deepEqual(init.headers, { accept: "application/json" });
		assert.equal(init.body, undefined);
	});

	it("returns a problem for a non-JSON error page", async () => {
		const { client } = mockApi({
			status: 502,
			body: "<html>Bad gateway</html>",
		});
		const result = await client.get("/places");
		assert.equal(result.ok, false);
		assert.equal(!result.ok && result.problem.status, 502);
		assert.match(!result.ok ? result.problem.detail! : "", /Bad gateway/);
	});

	it("reports an unreachable API as status 0", async () => {
		const client = createClient({
			baseUrl: BASE,
			fetch: async () => {
				throw new TypeError("fetch failed");
			},
		});
		const result = await client.get("/places");
		assert.equal(result.ok, false);
		assert.equal(!result.ok && result.status, 0);
		assert.match(!result.ok ? result.problem.detail! : "", /fetch failed/);
	});

	it("reports a timeout", async () => {
		const client = createClient({
			baseUrl: BASE,
			timeoutMs: 5,
			fetch: (_input, init) =>
				new Promise((_resolve, reject) => {
					init!.signal!.addEventListener("abort", () =>
						reject(init!.signal!.reason),
					);
				}),
		});
		const result = await client.get("/places");
		assert.equal(!result.ok && result.problem.title, "Request timed out");
	});
});

describe("success", () => {
	it("drops the envelope noise but keeps the cursor when there is another page", () => {
		const out = JSON.parse(
			success("u", {
				apiVersion: "v1",
				atlasRelease: "r",
				data: [1],
				meta: { nextCursor: "c" },
			}).content[0]!.text,
		);
		assert.deepEqual(out, {
			request: "u",
			atlasRelease: "r",
			data: [1],
			nextCursor: "c",
		});
	});

	it("says when it truncates a long answer", () => {
		const text = success("u", envelope("x".repeat(MAX_CHARS * 2)))
			.content[0]!.text;
		assert.match(text, /\[truncated: the full answer is \d+ characters/);
		assert.ok(text.length < MAX_CHARS + 400);
	});
});
