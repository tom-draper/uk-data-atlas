import { MEASURES, type Measure } from "./atoms.ts";

/** Where each atom lies in one release: an index into `codes`, or negative for none or several. */
export type Placement = { codes: string[]; area: Int32Array };

export type WeighedEdge = {
	fromVersion: number;
	toVersion: number;
	fromCode: string;
	toCode: string;
	/** Exact edges regroup whole and are weighed 1 by `v_crosswalk_weight`. */
	exact: boolean;
};

export type WeightRow = {
	fromVersion: number;
	toVersion: number;
	basis: Measure;
	weight: number;
	overlap: number;
	sourceShare: number;
	targetShare: number;
};

const COUNT = MEASURES.length;

/**
 * The measure of every atom placed in each area of `from`, in each of `to`, and
 * in each pair, by index into the placements' codes. A pair is keyed by
 * `from * width + to`.
 */
export const pairTotals = (
	measures: Record<Measure, Float64Array>,
	from: Placement,
	to: Placement,
) => {
	const atoms = from.area.length;
	if (to.area.length !== atoms)
		throw new Error("The two placements are of different atoms");
	const columns = MEASURES.map((name) => measures[name]);
	const sources = new Float64Array(from.codes.length * COUNT);
	const targets = new Float64Array(to.codes.length * COUNT);
	const pairs = new Map<number, Float64Array>();
	const width = to.codes.length;
	for (let atom = 0; atom < atoms; atom += 1) {
		const a = from.area[atom]!;
		const b = to.area[atom]!;
		if (a >= 0)
			for (let m = 0; m < COUNT; m += 1)
				sources[a * COUNT + m]! += columns[m]![atom]!;
		if (b >= 0)
			for (let m = 0; m < COUNT; m += 1)
				targets[b * COUNT + m]! += columns[m]![atom]!;
		if (a >= 0 && b >= 0) {
			const key = a * width + b;
			let pair = pairs.get(key);
			if (!pair) pairs.set(key, (pair = new Float64Array(COUNT)));
			for (let m = 0; m < COUNT; m += 1) pair[m]! += columns[m]![atom]!;
		}
	}
	return { sources, targets, pairs, width };
};

/**
 * The weights of a crosswalk's edges from atoms placed in both its releases.
 *
 * For each edge and basis, `overlap` is the measure of the atoms lying in both
 * areas, `sourceShare` and `targetShare` that overlap as a share of everything
 * in the source and in the target (so in areas the other side does not hold),
 * and `weight` the overlap as a share of the overlaps of all the source's
 * edges, which sum to 1. Only edges that are not exact are returned, and an
 * edge with nothing in its overlap has no row. A basis in `own` is the
 * crosswalk's already: it is left alone.
 */
export const weighEdges = (
	measures: Record<Measure, Float64Array>,
	from: Placement,
	to: Placement,
	edges: readonly WeighedEdge[],
	own: ReadonlySet<string> = new Set(),
): WeightRow[] => {
	const { sources, targets, pairs, width } = pairTotals(measures, from, to);
	const fromAt = new Map(from.codes.map((code, at) => [code, at]));
	const toAt = new Map(to.codes.map((code, at) => [code, at]));
	// Each edge's overlap, and each source's total over its edges.
	const found = edges.map((edge) => {
		const a = fromAt.get(edge.fromCode);
		const b = toAt.get(edge.toCode);
		return a === undefined || b === undefined
			? undefined
			: { a, b, pair: pairs.get(a * width + b) };
	});
	const totals = new Map<number, Float64Array>();
	for (const [at, edge] of edges.entries()) {
		const pair = found[at]?.pair;
		if (!pair) continue;
		let total = totals.get(edge.fromVersion);
		if (!total)
			totals.set(edge.fromVersion, (total = new Float64Array(COUNT)));
		for (let m = 0; m < COUNT; m += 1) total[m]! += pair[m]!;
	}
	const rows: WeightRow[] = [];
	for (const [at, edge] of edges.entries()) {
		const hit = found[at];
		if (edge.exact || !hit?.pair) continue;
		for (const [m, basis] of MEASURES.entries()) {
			const overlap = hit.pair[m]!;
			if (own.has(basis) || !(overlap > 0)) continue;
			rows.push({
				fromVersion: edge.fromVersion,
				toVersion: edge.toVersion,
				basis,
				weight: overlap / totals.get(edge.fromVersion)![m]!,
				overlap,
				sourceShare: overlap / sources[hit.a * COUNT + m]!,
				targetShare: overlap / targets[hit.b * COUNT + m]!,
			});
		}
	}
	return rows;
};
