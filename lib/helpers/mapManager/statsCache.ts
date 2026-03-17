// lib/utils/mapManager/statsCache.ts

const MAX_STATS_CACHE_SIZE = 200;

export class StatsCache {
	private cache = new Map<string, any>();

	get(key: string): any | null {
		return this.cache.get(key) ?? null;
	}

	set(key: string, value: any): void {
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
