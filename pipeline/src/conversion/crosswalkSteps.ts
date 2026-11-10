import type { DatabaseSync } from "node:sqlite";
import { EXACT_EDGE_SQL } from "../crosswalk-weights/exactEdges.ts";

/**
 * How a crosswalk carries a value from each of its source areas, on one weight
 * basis. This is the one place that decides whether an edge regroups a value
 * exactly, splits it by a weight, or cannot carry it at all.
 */

/** The bases a value can be apportioned on. `area` is never used for a measure. */
export const CONVERSION_BASES = [
	"population",
	"households",
	"dwellings",
	"postcodes",
] as const;
export type ConversionBasis = (typeof CONVERSION_BASES)[number];

/**
 * The crosswalk methods that can carry a value, best first. Where two
 * crosswalks join the same two releases, each source area is carried by the
 * first of these that has an edge for it. `area-overlap` is left out: land
 * area is not how any held measure is spread.
 */
export const CARRYING_METHODS = [
	"extent-continuity",
	"clean-containment",
	"geometric-containment",
	"postcode-overlap",
	"population-overlap",
	"official-lookup",
	"best-fit",
] as const;
export type CarryingMethod = (typeof CARRYING_METHODS)[number];

/** Methods whose every edge is the same area or a whole child, so cost nothing. */
const EXACT_METHODS: ReadonlySet<string> = new Set([
	"extent-continuity",
	"clean-containment",
	"geometric-containment",
]);

/**
 * A source counts as wholly inside its one target when at least this share of
 * its measured basis is there. Boundaries are generalised, so a few postcodes
 * of a ward that is inside a constituency can fall a metre outside it.
 */
export const WHOLE_SHARE = 0.999;

/**
 * Weights are stored to six decimal places, so the weights of an area split
 * several ways can sum to a little off 1. Anything further off is a fault in
 * the crosswalk and blocks the area.
 */
export const WEIGHT_SUM_TOLERANCE = 1e-5;

export type CrosswalkRow = {
	id: number;
	slug: string;
	method: string;
	purpose: string | null;
	fromRelease: number;
	toRelease: number;
};

/** Why a source area's value cannot be carried by a crosswalk. */
export type BlockReason =
	/** The edge is a split and no weight is held for the basis. */
	| "no-weight"
	/** Best fit gives the area one target, and part of it lies in another. */
	| "best-fit-straddler"
	/** A membership lookup lists several targets, each as the whole area. */
	| "ambiguous-membership"
	/** The weights of the area's edges do not sum to 1. */
	| "weights-do-not-sum";

export type StepEdge = {
	to: number;
	/** The share of the source's value this target takes. */
	weight: number;
	/**
	 * 0 for an exact regrouping. For a split, the share of the source's value
	 * that is at risk of being in the wrong target: `weight * (1 - weight)`,
	 * which is largest for an even split and small for a sliver.
	 */
	risk: number;
	/**
	 * The share of the source's value that the crosswalk's pruned pairs put in
	 * another target, though this edge carries the whole. 0 unless the source
	 * has one edge left and is not wholly inside it.
	 */
	pruned: number;
	/** The crosswalk the edge is from. */
	crosswalk: number;
};

export type Step = {
	fromRelease: number;
	toRelease: number;
	/** The crosswalks used, in the order sources were offered to them. */
	crosswalks: CrosswalkRow[];
	/** True where a crosswalk is walked from its targets to its sources. */
	reversed: boolean;
	edges: Map<number, StepEdge[]>;
	/** Sources that cannot be carried, with the targets left incomplete. */
	blocked: Map<number, { reason: BlockReason; targets: number[] }>;
	/** Every source with an edge into a target, carried or blocked. */
	feeders: Map<number, number[]>;
};

type EdgeRow = {
	f: number;
	t: number;
	exact_rule: number;
	weight: number | null;
	source_share: number | null;
	coverage: number | null;
};

export const splitRisk = (weight: number) => weight * (1 - weight);

/** The tables holding `crosswalk_weight` rows, as `schema.table`. */
export type WeightTables = readonly string[];

/**
 * `main.crosswalk_weight` holds each crosswalk's own basis. In a build the
 * other bases are still in the `crosswalk-weights` component, attached as
 * `weights_component`; in an assembled `atlas.sqlite` they are all in `main`.
 */
export const weightTablesOf = (database: DatabaseSync): WeightTables => {
	const attached = database
		.prepare("PRAGMA database_list")
		.all()
		.some((row) => row.name === "weights_component");
	return attached
		? ["main.crosswalk_weight", "weights_component.crosswalk_weight"]
		: ["main.crosswalk_weight"];
};

export const readCrosswalks = (database: DatabaseSync): CrosswalkRow[] =>
	database
		.prepare(
			"SELECT id, slug, method, purpose, from_release_id AS fromRelease, to_release_id AS toRelease FROM crosswalk ORDER BY id",
		)
		.all() as CrosswalkRow[];

const edgeRows = (
	database: DatabaseSync,
	weights: WeightTables,
	crosswalk: number,
	basis: ConversionBasis,
): EdgeRow[] => {
	const joins = weights
		.map(
			(table, index) =>
				`LEFT JOIN ${table} w${index} ON w${index}.crosswalk_id = e.crosswalk_id AND w${index}.from_version_id = e.from_version_id AND w${index}.to_version_id = e.to_version_id AND w${index}.basis_id = ?1`,
		)
		.join("\n");
	const pick = (column: string) =>
		`coalesce(${weights.map((_, index) => `w${index}.${column}`).join(", ")})`;
	return database
		.prepare(
			`SELECT e.from_version_id AS f, e.to_version_id AS t, ${EXACT_EDGE_SQL} AS exact_rule,
				${pick("weight")} AS weight, ${pick("source_share")} AS source_share, s.coverage AS coverage
			FROM crosswalk_edge e
			JOIN crosswalk c ON c.id = e.crosswalk_id
			${joins}
			LEFT JOIN crosswalk_source s ON s.crosswalk_id = e.crosswalk_id AND s.from_version_id = e.from_version_id
			WHERE e.crosswalk_id = ?2
			ORDER BY e.from_version_id, e.to_version_id`,
		)
		.all(basis, crosswalk) as EdgeRow[];
};

type Carried =
	{ edges: StepEdge[] } | { blocked: BlockReason; targets: number[] };

/** How one source area's edges in one crosswalk carry its value. */
export const carrySource = (
	crosswalk: Pick<CrosswalkRow, "id" | "method">,
	rows: readonly Omit<EdgeRow, "f">[],
): Carried => {
	const targets = rows.map((row) => row.t);
	const exact = (to: number): Carried => ({
		edges: [{ to, weight: 1, risk: 0, pruned: 0, crosswalk: crosswalk.id }],
	});
	const [only] = rows;
	if (rows.every((row) => row.exact_rule))
		return rows.length === 1
			? exact(only!.t)
			: { blocked: "ambiguous-membership", targets };
	if (rows.length === 1) {
		// A publisher's lookup that names one successor gives it the whole area.
		if (crosswalk.method === "official-lookup") return exact(only!.t);
		// What share of the source is in this target: of everything counted
		// for a best fit or an overlap, and of what the pruned pairs left for a
		// postcode overlap. Neither depends on the basis. Without one, a
		// weight for the basis shows the edge was measured.
		const measured =
			crosswalk.method === "postcode-overlap"
				? only!.coverage
				: only!.source_share;
		if (measured === null && only!.weight === null)
			return { blocked: "no-weight", targets };
		const share = measured ?? 1;
		if (share >= WHOLE_SHARE) return exact(only!.t);
		if (crosswalk.method === "best-fit")
			return { blocked: "best-fit-straddler", targets };
		return {
			edges: [
				{
					to: only!.t,
					weight: 1,
					risk: 0,
					pruned: 1 - share,
					crosswalk: crosswalk.id,
				},
			],
		};
	}
	if (rows.some((row) => row.weight === null))
		return { blocked: "no-weight", targets };
	const total = rows.reduce((sum, row) => sum + row.weight!, 0);
	if (Math.abs(total - 1) > WEIGHT_SUM_TOLERANCE)
		return { blocked: "weights-do-not-sum", targets };
	// Dividing by the total takes out the rounding, so a count is conserved.
	return {
		edges: rows.map((row) => ({
			to: row.t,
			weight: row.weight! / total,
			risk: splitRisk(row.weight! / total),
			pruned: 0,
			crosswalk: crosswalk.id,
		})),
	};
};

const bySource = (rows: readonly EdgeRow[]) => {
	const grouped = new Map<number, EdgeRow[]>();
	for (const row of rows) {
		const held = grouped.get(row.f);
		if (held) held.push(row);
		else grouped.set(row.f, [row]);
	}
	return grouped;
};

const priorityOf = (method: string) => {
	const index = (CARRYING_METHODS as readonly string[]).indexOf(method);
	return index === -1 ? CARRYING_METHODS.length : index;
};

/**
 * One step from a release to another, through the crosswalks given. Each
 * source area is carried by the first crosswalk, best method first, that has
 * an edge for it.
 */
export const buildStep = (
	database: DatabaseSync,
	crosswalks: readonly CrosswalkRow[],
	basis: ConversionBasis,
	weights: WeightTables = weightTablesOf(database),
): Step => {
	const [first] = crosswalks;
	if (!first) throw new Error("A step needs a crosswalk");
	for (const crosswalk of crosswalks)
		if (
			crosswalk.fromRelease !== first.fromRelease ||
			crosswalk.toRelease !== first.toRelease
		)
			throw new Error(
				`Crosswalks ${first.slug} and ${crosswalk.slug} join different releases`,
			);
	const ordered = [...crosswalks].sort(
		(a, b) => priorityOf(a.method) - priorityOf(b.method) || a.id - b.id,
	);
	const step: Step = {
		fromRelease: first.fromRelease,
		toRelease: first.toRelease,
		crosswalks: ordered,
		reversed: false,
		edges: new Map(),
		blocked: new Map(),
		feeders: new Map(),
	};
	const feed = (target: number, source: number) => {
		const held = step.feeders.get(target);
		if (held) held.push(source);
		else step.feeders.set(target, [source]);
	};
	for (const crosswalk of ordered)
		for (const [source, rows] of bySource(
			edgeRows(database, weights, crosswalk.id, basis),
		)) {
			if (step.edges.has(source) || step.blocked.has(source)) continue;
			const carried = carrySource(crosswalk, rows);
			if ("edges" in carried) {
				step.edges.set(source, carried.edges);
				for (const edge of carried.edges) feed(edge.to, source);
			} else {
				step.blocked.set(source, {
					reason: carried.blocked,
					targets: carried.targets,
				});
				for (const target of carried.targets) feed(target, source);
			}
		}
	return step;
};

/**
 * A step walked backwards. Only a crosswalk that joins each area to the same
 * area (`extent-continuity`) can be: every edge is one source to one target,
 * so the reverse is as exact as the forward.
 */
export const reverseStep = (step: Step): Step => {
	if (step.crosswalks.some((c) => c.method !== "extent-continuity"))
		throw new Error(
			"Only an extent-continuity crosswalk can be walked in reverse",
		);
	const reversed: Step = {
		fromRelease: step.toRelease,
		toRelease: step.fromRelease,
		crosswalks: step.crosswalks,
		reversed: true,
		edges: new Map(),
		blocked: new Map(),
		feeders: new Map(),
	};
	for (const [source, edges] of step.edges)
		for (const edge of edges) {
			if (reversed.edges.has(edge.to))
				throw new Error(
					`Extent-continuity crosswalk ${step.crosswalks[0]!.slug} joins one area to several`,
				);
			reversed.edges.set(edge.to, [{ ...edge, to: source }]);
			reversed.feeders.set(source, [edge.to]);
		}
	return reversed;
};

/** Whether every edge a method makes is exact, so a step of it adds no error. */
export const isExactMethod = (method: string) => EXACT_METHODS.has(method);
