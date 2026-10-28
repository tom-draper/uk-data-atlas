import { boundsIntersect, type Bounds } from "./areaGeometryPieces";
import { spatialCellKey, spatialCells } from "./geometrySpatialIndex";

/** Bounding-box candidates in the input order, including touching edges. */
export class CrosswalkSpatialIndex<T> {
	private readonly entries: Array<{ value: T; bounds: Bounds }>;
	private readonly buckets = new Map<string, number[]>();
	private readonly unbucketed: number[] = [];

	constructor(entries: Iterable<{ value: T; bounds: Bounds }>) {
		this.entries = [...entries];
		this.entries.forEach(({ bounds }, index) => {
			const cells = bounds.every(Number.isFinite)
				? spatialCells(bounds)
				: undefined;
			if (!cells) {
				this.unbucketed.push(index);
				return;
			}
			for (const cell of cells) {
				const key = spatialCellKey(cell);
				const bucket = this.buckets.get(key) ?? [];
				bucket.push(index);
				this.buckets.set(key, bucket);
			}
		});
	}

	query(bounds: Bounds): T[] {
		const cells = bounds.every(Number.isFinite)
			? spatialCells(bounds)
			: undefined;
		if (!cells)
			return this.entries
				.filter((entry) => boundsIntersect(bounds, entry.bounds))
				.map(({ value }) => value);
		const candidates = new Set(this.unbucketed);
		for (const cell of cells)
			for (const index of this.buckets.get(spatialCellKey(cell)) ?? [])
				candidates.add(index);
		return [...candidates]
			.sort((a, b) => a - b)
			.flatMap((index) => {
				const entry = this.entries[index]!;
				return boundsIntersect(bounds, entry.bounds)
					? [entry.value]
					: [];
			});
	}
}
