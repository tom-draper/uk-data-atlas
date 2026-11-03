import type { BoundingBox } from "@uk-data-atlas/catalogue/place-profile";

export function boundsOf(shapes: number[][][][][]): BoundingBox {
	const box: BoundingBox = [180, 90, -180, -90];
	for (const polygons of shapes)
		for (const polygon of polygons)
			for (const [x, y] of polygon[0]!) {
				box[0] = Math.min(box[0], x!);
				box[1] = Math.min(box[1], y!);
				box[2] = Math.max(box[2], x!);
				box[3] = Math.max(box[3], y!);
			}
	return box.map((value) => Math.round(value * 1e4) / 1e4) as BoundingBox;
}

/** The area-weighted centre of a shape's outer rings. */
export function centreOf(
	polygons: number[][][][],
): [number, number] | undefined {
	let area = 0;
	let x = 0;
	let y = 0;
	for (const [outer] of polygons)
		for (let i = 0; i < (outer?.length ?? 0) - 1; i++) {
			const [x0, y0] = outer![i]!;
			const [x1, y1] = outer![i + 1]!;
			const cross = x0! * y1! - x1! * y0!;
			area += cross;
			x += (x0! + x1!) * cross;
			y += (y0! + y1!) * cross;
		}
	return area === 0 ? undefined : [x / (3 * area), y / (3 * area)];
}
