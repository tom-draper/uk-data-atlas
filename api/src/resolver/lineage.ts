import type { AreaRecord } from "../areaInventory";
import type { CrosswalkLookup } from "./translation";
import {
	createAreaRelationshipIndex,
	type AreaRelation,
	type AreaRelationship,
	type AreaRelationshipIndex,
} from "../areaRelationships";
import { areaId, type AreaIdentity, type ResolvedSameCodeArea } from "./areas";

/** A published graph edge, reported once at its shortest distance from origin. */
export type TraversedRelationship = AreaRelationship & { from: string; depth: number };
export type ResolvedAreaHistory = { area: AreaRecord; relationships: AreaRelationship[]; lineage: TraversedRelationship[]; sameCodeReleases: ResolvedSameCodeArea[] };
export type ResolvedAreaRelationshipSummary = { relationships: AreaRelationship[]; byRelation: Partial<Record<AreaRelation, number>>; parentCount: number; childCount: number; crosswalks: AreaRelationship["crosswalk"][] };

/** Published relationship graph queries, including declared history and hierarchy. */
export class LineageResolver {
	private readonly index?: AreaRelationshipIndex;

	constructor(
		crosswalkLookup: CrosswalkLookup | undefined,
		private readonly area: (identity: AreaIdentity) => AreaRecord | undefined,
		private readonly sameCode: (identity: AreaIdentity) => ResolvedSameCodeArea[],
	) {
		if (crosswalkLookup) this.index = createAreaRelationshipIndex(crosswalkLookup.values());
	}

	hasAreaRelationships(): boolean { return this.index !== undefined; }
	relationships(identity: AreaIdentity): AreaRelationship[] { return this.index?.get(areaId(identity)) ?? []; }

	private traverse(identity: AreaIdentity, follow: (relation: AreaRelation) => boolean, maximumDepth: number): TraversedRelationship[] {
		const origin = areaId(identity);
		const visited = new Set([origin]);
		const reported = new Set<string>();
		const queue = [{ id: origin, depth: 0 }];
		const edges: TraversedRelationship[] = [];
		while (queue.length > 0) {
			const current = queue.shift()!;
			if (current.depth >= maximumDepth) continue;
			for (const relationship of this.index?.get(current.id) ?? []) {
				if (!follow(relationship.relation)) continue;
				const ends = [current.id, relationship.counterpart.id].sort();
				const edge = `${relationship.crosswalk.id}|${ends[0]}|${ends[1]}`;
				if (!reported.has(edge)) {
					reported.add(edge);
					edges.push({ ...relationship, from: current.id, depth: current.depth + 1 });
				}
				if (!visited.has(relationship.counterpart.id)) {
					visited.add(relationship.counterpart.id);
					queue.push({ id: relationship.counterpart.id, depth: current.depth + 1 });
				}
			}
		}
		return edges;
	}

	ancestorLineage(identity: AreaIdentity, maximumDepth: number) { return this.traverse(identity, (relation) => relation === "within", maximumDepth); }
	descendantLineage(identity: AreaIdentity, maximumDepth: number) { return this.traverse(identity, (relation) => relation === "contains", maximumDepth); }

	areaRelationshipSummary(identity: AreaIdentity): ResolvedAreaRelationshipSummary {
		const relationships = this.relationships(identity);
		const byRelation = relationships.reduce<Partial<Record<AreaRelation, number>>>((counts, { relation }) => {
			counts[relation] = (counts[relation] ?? 0) + 1;
			return counts;
		}, {});
		return { relationships, byRelation, parentCount: byRelation.within ?? 0, childCount: byRelation.contains ?? 0, crosswalks: [...new Map(relationships.map((relationship) => [relationship.crosswalk.id, relationship.crosswalk])).values()] };
	}

	areaHistory(identity: AreaIdentity, maximumDepth = 8): ResolvedAreaHistory | undefined {
		const area = this.area(identity);
		if (!area) return undefined;
		const origin = areaId(identity);
		return {
			area,
			relationships: (this.index?.get(origin) ?? []).filter(({ relation }) => relation === "successor" || relation === "predecessor"),
			lineage: this.traverse(identity, (relation) => relation === "successor" || relation === "predecessor", maximumDepth),
			sameCodeReleases: this.sameCode(identity),
		};
	}
}
