import type { AreaInventory, AreaRecord } from "./areaInventory";

export class LazyAreaLookup extends Map<string, Map<string, AreaRecord>> {
	private readonly loaded = new Map<string, Map<string, AreaRecord>>();
	private readonly releases: Map<string, AreaInventory["releases"][number]>;
	private loadedRecords = 0;

	constructor(
		private readonly readAreas: (
			release: Extract<
				AreaInventory["releases"][number],
				{ status: "available" }
			>,
		) => AreaRecord[],
		inventory: AreaInventory,
		private readonly maxRecords: number,
	) {
		super();
		this.releases = new Map(
			inventory.releases.flatMap((release) => {
				if (release.status !== "available") return [];
				const key = `${release.geography}/${release.id}`;
				super.set(key, new Map());
				return [[key, release]];
			}),
		);
	}

	override get(key: string) {
		const cached = this.loaded.get(key);
		if (cached) {
			this.loaded.delete(key);
			this.loaded.set(key, cached);
			return cached;
		}
		const release = this.releases.get(key);
		if (!release || release.status !== "available") return undefined;
		const areas = new Map(
			this.readAreas(release).map((area) => [area.code, area]),
		);
		this.loaded.set(key, areas);
		this.loadedRecords += areas.size;
		// Evict least recently used releases, but always keep the one just read.
		for (const [oldest, records] of this.loaded) {
			if (this.loadedRecords <= this.maxRecords || oldest === key) break;
			this.loaded.delete(oldest);
			this.loadedRecords -= records.size;
		}
		return areas;
	}

	override *entries(): MapIterator<[string, Map<string, AreaRecord>]> {
		for (const key of this.keys()) yield [key, this.get(key)!];
	}

	override *values(): MapIterator<Map<string, AreaRecord>> {
		for (const key of this.keys()) yield this.get(key)!;
	}

	override [Symbol.iterator]() {
		return this.entries();
	}

	override forEach(
		callback: (
			value: Map<string, AreaRecord>,
			key: string,
			map: Map<string, Map<string, AreaRecord>>,
		) => void,
		thisArg?: unknown,
	) {
		for (const [key, value] of this)
			callback.call(thisArg, value, key, this);
	}
}
