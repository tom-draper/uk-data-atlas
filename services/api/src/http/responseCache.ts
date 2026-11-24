/**
 * A successful answer as it goes on the wire, minus what belongs to one
 * request: no request id, rate limit or deprecation fields.
 */
export type CachedAnswer = {
	status: 200;
	headers: Record<string, string>;
	body: string | Buffer;
	/** The validator in `headers`, kept to answer a conditional request. */
	etag: string;
};

export type ResponseCacheStats = {
	entries: number;
	bytes: number;
	maxBytes: number;
	hits: number;
	misses: number;
	evictions: number;
};

/** What an entry costs besides its body: its key, headers and bookkeeping. */
const ENTRY_OVERHEAD_BYTES = 1024;

/** The largest body kept, so one big answer cannot push out many small ones. */
export const MAX_CACHED_BODY_BYTES = 1024 * 1024;

/**
 * Finished answers by request, least recently used first, held up to a total
 * size. A response is a function of the Atlas release the server loaded and
 * the request, so a repeat is answered without running its handler, encoding
 * it, hashing it or compressing it again, and a conditional request is
 * answered `304` from the stored validator.
 */
export class ResponseCache {
	private readonly entries = new Map<
		string,
		{ answer: CachedAnswer; bytes: number }
	>();
	private bytes = 0;
	private readonly counts = { hits: 0, misses: 0, evictions: 0 };

	constructor(readonly maxBytes: number) {
		if (!Number.isInteger(maxBytes) || maxBytes < 1)
			throw new Error("A response cache must hold at least one byte.");
	}

	get(key: string): CachedAnswer | undefined {
		const entry = this.entries.get(key);
		if (!entry) {
			this.counts.misses += 1;
			return undefined;
		}
		this.counts.hits += 1;
		this.entries.delete(key);
		this.entries.set(key, entry);
		return entry.answer;
	}

	set(key: string, answer: CachedAnswer) {
		const bytes =
			Buffer.byteLength(answer.body) + key.length + ENTRY_OVERHEAD_BYTES;
		if (
			Buffer.byteLength(answer.body) > MAX_CACHED_BODY_BYTES ||
			bytes > this.maxBytes
		)
			return;
		const previous = this.entries.get(key);
		if (previous) {
			this.bytes -= previous.bytes;
			this.entries.delete(key);
		}
		this.entries.set(key, { answer, bytes });
		this.bytes += bytes;
		while (this.bytes > this.maxBytes) {
			const [oldest, entry] = this.entries.entries().next().value as [
				string,
				{ bytes: number },
			];
			this.entries.delete(oldest);
			this.bytes -= entry.bytes;
			this.counts.evictions += 1;
		}
	}

	stats(): ResponseCacheStats {
		return {
			entries: this.entries.size,
			bytes: this.bytes,
			maxBytes: this.maxBytes,
			...this.counts,
		};
	}
}
