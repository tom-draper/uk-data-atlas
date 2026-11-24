import type { UsageEvent } from "./usageLabels";
import { UsageStore, utcDay, type UsageRow } from "./usageStore";

/**
 * Buffers usage in memory and writes it to the store in batches, so a request
 * never waits on the disk. Counts are summed per distinct label set and day,
 * so the buffer holds one entry per combination rather than one per request.
 *
 * A process that is killed loses at most one flush interval of counts, which
 * is the price of not writing per request. Shutdown flushes what is held.
 */
export type UsageRecorderOptions = {
	/** Most distinct label sets held between flushes. */
	maxKeys?: number;
	now?: () => number;
	onError?: (error: unknown) => void;
};

const DEFAULT_MAX_KEYS = 10_000;

const keyOf = (day: string, event: UsageEvent) =>
	JSON.stringify([
		day,
		event.route,
		event.outcome,
		event.problem,
		event.measure,
		event.geography,
		event.release,
		event.notFound,
	]);

export class UsageRecorder {
	private pending = new Map<string, UsageRow>();
	private timer: NodeJS.Timeout | undefined;
	private closed = false;
	private readonly maxKeys: number;
	private readonly now: () => number;
	private readonly onError: (error: unknown) => void;
	/** Counts discarded because the buffer was full. */
	dropped = 0;

	constructor(
		private readonly store: UsageStore,
		options: UsageRecorderOptions = {},
	) {
		this.maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
		this.now = options.now ?? Date.now;
		this.onError = options.onError ?? (() => {});
	}

	record(event: UsageEvent) {
		const day = utcDay(this.now());
		const key = keyOf(day, event);
		const held = this.pending.get(key);
		if (held) held.requests += 1;
		else if (this.pending.size < this.maxKeys)
			this.pending.set(key, { ...event, day, requests: 1 });
		else this.dropped += 1;
	}

	/**
	 * Write what is held. A failed write keeps the counts for the next one, so
	 * a locked file delays them rather than losing them.
	 */
	flush() {
		if (this.pending.size === 0) return;
		const rows = [...this.pending.values()];
		const taken = this.pending;
		this.pending = new Map();
		try {
			this.store.add(rows);
		} catch (error) {
			for (const [key, row] of taken) {
				const later = this.pending.get(key);
				if (later) later.requests += row.requests;
				else if (this.pending.size < this.maxKeys)
					this.pending.set(key, row);
				else this.dropped += row.requests;
			}
			this.onError(error);
		}
	}

	/** Flush every `intervalMs`, without keeping the process alive. */
	start(intervalMs: number) {
		this.timer ??= setInterval(() => this.flush(), intervalMs);
		this.timer.unref();
	}

	/** Stop flushing, write what is left and release the file. */
	close() {
		if (this.closed) return;
		this.closed = true;
		clearInterval(this.timer);
		this.timer = undefined;
		this.flush();
		this.store.close();
	}
}
