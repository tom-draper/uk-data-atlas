import type { Coordinate } from "./types";
import {
	GEOMETRY_TIERS,
	isGeometryTier,
	vertexImportance,
	type GeometryTier,
} from "./simplifyGeometry";
import { rebuildAreas, rebuildRing, type Topology } from "./arcs";
import type { GeoJsonGeometry } from "./types";

/**
 * Generalise a decomposed release one arc at a time.
 *
 * Every area that references an arc gets the identical simplified coordinates,
 * because there is only one copy to simplify. Two areas either share an arc
 * exactly or do not share it at all, at every tier, which is the guarantee a
 * map needs and the one `simplifyGeometry` cannot give.
 */

export type TierGeometry = {
	tier: GeometryTier;
	toleranceM: number;
	minEffectiveAreaM2: number;
	areas: Map<string, GeoJsonGeometry>;
	arcs: Coordinate[][];
	verticesBefore: number;
	verticesAfter: number;
	/**
	 * Arcs given back some detail because a ring built from them enclosed
	 * nothing at the tier's own threshold. A high count says the tier is too
	 * coarse for this release; zero says the tier held everywhere.
	 */
	refinedArcs: number;
};

/** How far a threshold is cut each time a ring turns out to need more detail. */
const REFINEMENT_STEP = 8;

/**
 * One tier of a decomposed release: every arc generalised once, areas rebuilt.
 *
 * A ring made of two or three arcs can collapse when each is cut back to the
 * junctions at its ends: the ring is still there, but it encloses nothing and
 * is no longer drawable. Rather than drop the part, which would take an island
 * off the map without saying so, the arcs of a collapsed ring are simplified
 * at a finer threshold until the ring encloses something. The cached removal
 * sequence gives every area referencing a refined arc the same
 * refinement and borders stay shared.
 */
const compileTier = (
	topology: Topology,
	tier: GeometryTier,
	importance: Float64Array[],
): TierGeometry => {
	const toleranceM = GEOMETRY_TIERS[tier];
	const minEffectiveAreaM2 = toleranceM * toleranceM;
	const verticesBefore = topology.arcs.reduce(
		(total, arc) => total + arc.length,
		0,
	);
	if (toleranceM === 0)
		return {
			tier,
			toleranceM,
			minEffectiveAreaM2,
			areas: rebuildAreas(topology, topology.arcs),
			arcs: topology.arcs,
			verticesBefore,
			verticesAfter: verticesBefore,
			refinedArcs: 0,
		};

	const thresholds = new Float64Array(topology.arcs.length).fill(
		minEffectiveAreaM2,
	);
	const refined = new Uint8Array(topology.arcs.length);
	const simplify = (index: number) =>
		topology.arcs[index]!.filter(
			(_, vertex) => importance[index]![vertex]! >= thresholds[index]!,
		);
	const arcs = topology.arcs.map((_, index) => simplify(index));

	// A ring encloses nothing until it has three distinct coordinates and a
	// repeat of the first.
	const collapsed = () =>
		[...topology.areas.values()].flatMap((polygons) =>
			polygons.flatMap((polygon) =>
				polygon.filter((ring) => rebuildRing(ring, arcs).length < 4),
			),
		);
	for (let pass = 0; ; pass += 1) {
		const rings = collapsed();
		if (rings.length === 0) break;
		let cut = false;
		for (const ring of rings) {
			for (const { arc } of ring) {
				if (thresholds[arc] === 0) continue;
				thresholds[arc] = Math.floor(
					thresholds[arc]! / REFINEMENT_STEP,
				);
				refined[arc] = 1;
				arcs[arc] = simplify(arc);
				cut = true;
			}
		}
		// Every arc of every collapsed ring is already at its full detail, so
		// the ring is degenerate in the source and no threshold will save it.
		if (!cut) break;
		/* c8 ignore next 5 */
		if (pass > 64)
			throw new Error(
				"Refining collapsed rings did not settle; the decomposition is inconsistent.",
			);
	}

	return {
		tier,
		toleranceM,
		minEffectiveAreaM2,
		areas: rebuildAreas(topology, arcs),
		arcs,
		verticesBefore,
		verticesAfter: arcs.reduce((total, arc) => total + arc.length, 0),
		refinedArcs: refined.reduce<number>((total, flag) => total + flag, 0),
	};
};

/** Compile every tier from one removal sequence per arc, including refinements. */
export const compileTiers = (
	topology: Topology,
	tiers: readonly GeometryTier[] = Object.keys(GEOMETRY_TIERS).filter(
		isGeometryTier,
	),
): Map<GeometryTier, TierGeometry> => {
	const maxThresholdM2 = Math.max(...Object.values(GEOMETRY_TIERS)) ** 2;
	const importance = topology.arcs.map((arc, index) =>
		vertexImportance(arc, topology.closed[index]!, maxThresholdM2),
	);
	return new Map(
		tiers.map((tier) => [tier, compileTier(topology, tier, importance)]),
	);
};

/**
 * Sent with a map resource, so a drawing carries the terms it was made on.
 * The last line is the limit worth stating plainly: sharing a border is not
 * the same as staying a valid polygon everywhere.
 */
export const TOPOLOGY_METHOD = {
	rule: "Visvalingam-Whyatt over shared arcs. The release is split into arcs at every junction where the pair of areas a boundary separates changes, each arc is simplified once, and every area is rebuilt from the simplified arcs.",
	threshold:
		"A tier is the side of the smallest square of detail kept, and its threshold is that square's area, measured in the EPSG:6933 equal-area projection. It bounds the size of feature dropped, not the distance any vertex moves.",
	sharedBorders:
		"A border between two areas is one arc, simplified once, so both areas carry identical coordinates along it at every tier. Neighbours cannot crack apart or diverge, however coarse the tier.",
	junctions:
		"A vertex where the boundary changes which pair of areas it separates is kept at every tier. Three areas that meet at a point still meet at that point.",
	parts: "No part is dropped. An arc is never reduced below the two coordinates that connect its junctions, or the three that enclose a ring, and where a ring built from those would enclose nothing its arcs are simplified again at a finer threshold until it does. A small island stays on the map as a coarse shape rather than disappearing from it.",
	validity:
		"Arcs are simplified independently of each other. Shared borders stay shared, but a generalised arc can cross another arc it does not touch, so a coarse tier is not guaranteed to be a topologically valid coverage.",
} as const;
