// lib/utils/mapManager/statsCache.ts

export class StatsCache {
	private cache = new Map<string, any>();

	get(key: string): any | null {
		const cached = this.cache.get(key);
		if (cached) {
			console.log(`CACHE HIT: ${key}`);
		}
		return cached || null;
	}

	set(key: string, value: any): void {
		this.cache.set(key, value);
	}

	clear(): void {
		this.cache.clear();
	}

	delete(key: string): void {
		this.cache.delete(key);
	}
}
