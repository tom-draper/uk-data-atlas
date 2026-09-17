import assert from "node:assert/strict";
import test from "node:test";
import { clientAddress, clientKey, RateLimiter } from "../src/rateLimit";

test("spends a burst and earns requests back at the refill rate", () => {
	let now = 0;
	const limiter = new RateLimiter(
		{ capacity: 3, refillPerSecond: 1 },
		() => now,
	);
	assert.deepEqual(
		[1, 2, 3, 4].map(() => limiter.take("a").allowed),
		[true, true, true, false],
	);
	assert.equal(limiter.take("a").retryAfterSeconds, 1);
	// Another client has its own bucket.
	assert.equal(limiter.take("b").allowed, true);
	now = 1.5;
	const decision = limiter.take("a");
	assert.equal(decision.allowed, true);
	assert.equal(decision.remaining, 0);
	now = 100;
	assert.equal(limiter.take("a").remaining, 2);
});

test("forgets the least recently seen client first", () => {
	const limiter = new RateLimiter(
		{ capacity: 1, refillPerSecond: 0.001, maxClients: 2 },
		() => 0,
	);
	limiter.take("a");
	limiter.take("b");
	limiter.take("a");
	limiter.take("c");
	assert.equal(limiter.clientCount, 2);
	// b was forgotten, so it starts again with a full bucket; a was not.
	assert.equal(limiter.take("b").allowed, true);
	assert.equal(limiter.take("c").allowed, false);
});

test("refuses a policy that could never allow a request", () => {
	assert.throws(() => new RateLimiter({ capacity: 0, refillPerSecond: 1 }));
	assert.throws(() => new RateLimiter({ capacity: 5, refillPerSecond: 0 }));
});

test("limits an IPv6 client by its /64", () => {
	assert.equal(clientKey("203.0.113.7"), "203.0.113.7");
	assert.equal(clientKey("::ffff:203.0.113.7"), "203.0.113.7");
	assert.equal(clientKey("2001:db8:0:1::1"), "2001:db8:0:1::/64");
	assert.equal(
		clientKey("2001:0DB8:0000:0001:aaaa:bbbb:cccc:dddd"),
		"2001:db8:0:1::/64",
	);
	assert.equal(clientKey("::1"), "0:0:0:0::/64");
});

test("trusts X-Forwarded-For only as far as the declared proxies", () => {
	const request = (forwarded?: string) =>
		({
			headers: forwarded ? { "x-forwarded-for": forwarded } : {},
			socket: { remoteAddress: "10.0.0.1" },
		}) as unknown as Parameters<typeof clientAddress>[0];
	assert.equal(clientAddress(request("198.51.100.1")), "10.0.0.1");
	assert.equal(clientAddress(request("198.51.100.1"), 1), "198.51.100.1");
	assert.equal(
		clientAddress(request("spoofed, 198.51.100.1, 192.0.2.5"), 2),
		"198.51.100.1",
	);
	assert.equal(clientAddress(request("198.51.100.1"), 2), "10.0.0.1");
	assert.equal(clientAddress(request(), 1), "10.0.0.1");
});
