import type { IncomingMessage } from "node:http";

/**
 * A token bucket per client. A client may spend `capacity` requests at once,
 * which is what a map drawing a view needs, and earns them back at
 * `refillPerSecond`. The data is openly licensed and read-only, so the limit
 * exists to keep one client from starving the others, not to meter access.
 */
export type RateLimitPolicy = {
	capacity: number;
	refillPerSecond: number;
	/**
	 * The most clients remembered at once. The least recently seen is
	 * forgotten first; a forgotten client starts again with a full bucket,
	 * which is what an idle client would have earned anyway.
	 */
	maxClients?: number;
};

export type RateLimitDecision = {
	allowed: boolean;
	limit: number;
	remaining: number;
	/** Seconds until the bucket is full again. */
	resetSeconds: number;
	/** Seconds until the refused request could be afforded. */
	retryAfterSeconds?: number;
};

const DEFAULT_MAX_CLIENTS = 100_000;

export class RateLimiter {
	private readonly buckets = new Map<
		string,
		{ tokens: number; updated: number }
	>();
	constructor(
		readonly policy: RateLimitPolicy,
		private readonly now: () => number = () => performance.now() / 1000,
	) {
		if (!(policy.capacity >= 1) || !(policy.refillPerSecond > 0))
			throw new Error(
				"A rate limit needs a capacity of at least 1 and a positive refill rate.",
			);
	}

	get clientCount() {
		return this.buckets.size;
	}

	take(client: string, cost = 1): RateLimitDecision {
		const { capacity, refillPerSecond } = this.policy;
		const now = this.now();
		const previous = this.buckets.get(client);
		const tokens = previous
			? Math.min(
					capacity,
					previous.tokens +
						(now - previous.updated) * refillPerSecond,
				)
			: capacity;
		const allowed = tokens >= cost;
		const left = allowed ? tokens - cost : tokens;
		// Re-inserting keeps the map in order of last use, so the first key is
		// always the client to forget.
		this.buckets.delete(client);
		this.buckets.set(client, { tokens: left, updated: now });
		while (
			this.buckets.size > (this.policy.maxClients ?? DEFAULT_MAX_CLIENTS)
		)
			this.buckets.delete(this.buckets.keys().next().value as string);
		return {
			allowed,
			limit: capacity,
			remaining: Math.floor(left),
			resetSeconds: Math.ceil((capacity - left) / refillPerSecond),
			...(allowed
				? {}
				: {
						retryAfterSeconds: Math.max(
							1,
							Math.ceil((cost - left) / refillPerSecond),
						),
					}),
		};
	}

	/**
	 * The `RateLimit-Policy` and `RateLimit` fields of the IETF HTTPAPI draft,
	 * with `q` the bucket's capacity and `w` the seconds it takes to refill.
	 */
	headers(decision: RateLimitDecision): Record<string, string> {
		const window = Math.ceil(
			this.policy.capacity / this.policy.refillPerSecond,
		);
		return {
			"ratelimit-policy": `"default";q=${this.policy.capacity};w=${window}`,
			ratelimit: `"default";r=${decision.remaining};t=${decision.resetSeconds}`,
			...(decision.retryAfterSeconds === undefined
				? {}
				: { "retry-after": String(decision.retryAfterSeconds) }),
		};
	}
}

/** An IPv6 address in full, eight groups, so a prefix can be taken from it. */
const expandIpv6 = (address: string) => {
	const [head, tail] = address.split("::") as [string, string | undefined];
	const left = head ? head.split(":") : [];
	const right = tail ? tail.split(":") : [];
	const missing = tail === undefined ? 0 : 8 - left.length - right.length;
	return [...left, ...Array<string>(missing).fill("0"), ...right];
};

/**
 * The key a client is limited under. An IPv4 address is its own key. An IPv6
 * client is usually given a whole /64, so it is limited by that prefix rather
 * than by an address it can change at will.
 */
export const clientKey = (address: string) => {
	const plain = address.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
	if (!plain.includes(":")) return plain;
	return `${expandIpv6(plain.split("%")[0]!)
		.slice(0, 4)
		.map((group) => group.toLowerCase().replace(/^0+(?=.)/, ""))
		.join(":")}::/64`;
};

/**
 * The address a request came from. Behind `trustedProxyHops` proxies, each of
 * which appends the address it received from to `X-Forwarded-For`, the client
 * is that many entries from the right; anything further left was written by
 * the client and cannot be trusted. With no trusted proxy the header is
 * ignored entirely.
 */
export const clientAddress = (
	request: Pick<IncomingMessage, "headers" | "socket">,
	trustedProxyHops = 0,
) => {
	const socket = request.socket.remoteAddress ?? "unknown";
	if (trustedProxyHops <= 0) return socket;
	const header = request.headers["x-forwarded-for"];
	const forwarded = (
		Array.isArray(header) ? header.join(",") : (header ?? "")
	)
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
	// Fewer entries than proxies means the request did not come through them
	// all, so only the socket is known.
	return forwarded[forwarded.length - trustedProxyHops] ?? socket;
};
