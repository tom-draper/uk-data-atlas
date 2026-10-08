import assert from "node:assert/strict";
import test from "node:test";
import {
	MAX_CACHED_BODY_BYTES,
	ResponseCache,
	type CachedAnswer,
} from "../src/responseCache";

const answer = (body: string | Buffer): CachedAnswer => ({
	status: 200,
	headers: { etag: '"a"' },
	body,
	etag: '"a"',
});

test("returns what it was given and counts hits and misses", () => {
	const cache = new ResponseCache(1_000_000);
	assert.equal(cache.get("/one"), undefined);
	const held = answer("one");
	cache.set("/one", held);
	assert.equal(cache.get("/one"), held);
	assert.deepEqual(
		{ ...cache.stats(), bytes: undefined },
		{
			entries: 1,
			bytes: undefined,
			maxBytes: 1_000_000,
			hits: 1,
			misses: 1,
			evictions: 0,
		},
	);
});

test("forgets the least recently used answer first when it is full", () => {
	// Each entry costs its body, its key and a fixed overhead.
	const cache = new ResponseCache(3 * (1024 + 3 + 2));
	cache.set("/a", answer("aaa"));
	cache.set("/b", answer("bbb"));
	cache.set("/c", answer("ccc"));
	// Reading /a makes /b the oldest.
	assert.ok(cache.get("/a"));
	cache.set("/d", answer("ddd"));
	assert.equal(cache.get("/b"), undefined);
	assert.ok(cache.get("/a"));
	assert.ok(cache.get("/c"));
	assert.ok(cache.get("/d"));
	assert.equal(cache.stats().evictions, 1);
	assert.equal(cache.stats().entries, 3);
});

test("replacing an answer does not count it twice", () => {
	const cache = new ResponseCache(1_000_000);
	cache.set("/a", answer("aaa"));
	const once = cache.stats().bytes;
	cache.set("/a", answer("aaa"));
	assert.equal(cache.stats().bytes, once);
	assert.equal(cache.stats().entries, 1);
});

test("does not keep an answer too big for it or too big to be worth it", () => {
	const small = new ResponseCache(2000);
	small.set("/big", answer("x".repeat(2000)));
	assert.equal(small.stats().entries, 0);

	const large = new ResponseCache(100 * MAX_CACHED_BODY_BYTES);
	large.set("/huge", answer(Buffer.alloc(MAX_CACHED_BODY_BYTES + 1)));
	assert.equal(large.stats().entries, 0);
	large.set("/limit", answer(Buffer.alloc(MAX_CACHED_BODY_BYTES)));
	assert.equal(large.stats().entries, 1);
});

test("refuses a size that can hold nothing", () => {
	assert.throws(() => new ResponseCache(0));
});
