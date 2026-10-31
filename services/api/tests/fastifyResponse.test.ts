import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";
import Fastify from "fastify";
import { envelope } from "@uk-data-atlas/atlas-runtime/api";
import { sendFastifyResponse } from "../src/fastifyResponse";
import { httpResponse } from "../src/httpResponse";

test("Fastify streams stored files, ranges and stored gzip representations", async (t) => {
	const dir = mkdtempSync(join(tmpdir(), "atlas-fastify-response-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const bytes = Buffer.from("0123456789");
	const compressed = gzipSync(bytes);
	const path = join(dir, "plain");
	const gzipPath = join(dir, "gzip");
	writeFileSync(path, bytes);
	writeFileSync(gzipPath, compressed);
	const app = Fastify();
	for (const [url, file] of [
		["/plain", { path, bytes: bytes.length, contentHash: "sha256:test" }],
		[
			"/gzip",
			{
				path: gzipPath,
				bytes: bytes.length,
				gzipBytes: compressed.length,
				contentHash: "sha256:test",
			},
		],
	] as const) {
		app.get(url, (request, reply) =>
			sendFastifyResponse(
				reply,
				httpResponse(request.raw, () => ({
					status: 200,
					body: envelope("release", null),
					representation: {
						contentType: "application/octet-stream",
						body: file,
					},
				})),
			),
		);
	}
	t.after(() => app.close());
	const full = await app.inject("/plain");
	assert.equal(full.statusCode, 200);
	assert.deepEqual(full.rawPayload, bytes);
	const range = await app.inject({
		url: "/plain",
		headers: { range: "bytes=2-5" },
	});
	assert.equal(range.statusCode, 206);
	assert.equal(range.headers["content-range"], "bytes 2-5/10");
	assert.equal(range.body, "2345");
	const decoded = await app.inject({
		url: "/gzip",
		headers: { "accept-encoding": "identity" },
	});
	assert.deepEqual(decoded.rawPayload, bytes);
	const encoded = await app.inject({
		url: "/gzip",
		headers: { "accept-encoding": "gzip" },
	});
	assert.equal(encoded.headers["content-encoding"], "gzip");
	assert.deepEqual(gunzipSync(encoded.rawPayload), bytes);
});
