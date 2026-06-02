// lib/utils/mapManager/statsCache.ts

const MAX_STATS_CACHE_SIZE = 200;

export class StatsCache {
	private cache = new Map<string, unknown>();

	get(key: string): unknown {
		if (!this.cache.has(key)) return undefined;
		const value = this.cache.get(key);
		this.cache.delete(key);
		this.cache.set(key, value);
		return value;
	}

	set(key: string, value: unknown): void {
		if (this.cache.size >= MAX_STATS_CACHE_SIZE) {
			this.cache.delete(this.cache.keys().next().value!);
		}
		this.cache.set(key, value);
	}

	clear(): void {
		this.cache.clear();
	}

	delete(key: string): void {
		this.cache.delete(key);
	}
}
