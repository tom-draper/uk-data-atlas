import type {
	CrosswalkArtifact,
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkWeighting,
} from "./crosswalkInventory";
import { areaKey } from "./geographyKeys";

export type AreaRelation =
	| "within"
	| "contains"
	| "successor"
	| "predecessor"
	| "split-from"
	| "merged-from"
	| "equivalent-to"
	| "overlaps";

export type AreaOverlap = {
	areaM2: number;
	/** Overlap as a share of this area. */
	shareOfArea: number;
	/** Overlap as a share of the counterpart area. */
	shareOfCounterpart: number;
};

export type AreaRelationship = {
	relation: AreaRelation;
	counterpart: {
		id: string;
		geography: string;
		boundaryRelease: string;
		code: string;
		labels: string[];
	};
	crosswalk: {
		id: string;
		method: CrosswalkMethod;
		quality: CrosswalkQuality;
		weighting: CrosswalkWeighting;
	};
	overlap?: AreaOverlap;
};

export type AreaRelationshipIndex = Map<string, AreaRelationship[]>;

const areaId = (geography: string, boundaryRelease: string, code: string) =>
	areaKey(geography, boundaryRelease, code);

const relationFor = (
	{ method, relationshipPurpose }: CrosswalkArtifact,
	target: CrosswalkArtifact["records"][number]["targets"][number],
	direction: "from" | "to",
	cardinality: { sourceTargetCount: number; targetSourceCount: number },
): AreaRelation => {
	// A best fit claims containment only for a child it measured within its
	// parent; one that straddles lies mostly there, which is an overlap.
	if (method === "best-fit")
		return "relation" in target && target.relation === "within"
			? direction === "from"
				? "within"
				: "contains"
			: "overlaps";
	// An official lookup declared as membership, such as district to region,
	// states belonging, not succession.
	if (
		method === "clean-containment" ||
		method === "geometric-containment" ||
		relationshipPurpose === "membership"
	) {
		return direction === "from" ? "within" : "contains";
	}
	if (method === "area-overlap" || method === "population-overlap")
		return "overlaps";
	// Extent continuity is the only published evidence that two successive
	// identities have the same extent, so it earns a stronger relation than a
	// same code or a one-to-one official correspondence.
	if (method === "extent-continuity") return "equivalent-to";
	if (direction === "from") return "successor";
	if (
		cardinality.sourceTargetCount > 1 &&
		cardinality.targetSourceCount === 1
	)
		return "split-from";
	if (
		cardinality.targetSourceCount > 1 &&
		cardinality.sourceTargetCount === 1
	)
		return "merged-from";
	return "predecessor";
};

/** Edges that describe an area across boundary releases rather than membership. */
export const isLineageRelation = (relation: AreaRelation): boolean =>
	[
		"successor",
		"predecessor",
		"split-from",
		"merged-from",
		"equivalent-to",
	].includes(relation);

const overlapFor = (
	crosswalk: CrosswalkArtifact,
	target: CrosswalkArtifact["records"][number]["targets"][number],
	direction: "from" | "to",
): { overlap?: AreaOverlap } => {
	// Only an area overlap's shares are of area; a population overlap's are
	// of people, and are read from its crosswalk rather than restated here.
	if (crosswalk.method !== "area-overlap" || !("overlapAreaM2" in target))
		return {};
	return {
		overlap: {
			areaM2: target.overlapAreaM2,
			shareOfArea:
				direction === "from" ? target.sourceShare : target.targetShare,
			shareOfCounterpart:
				direction === "from" ? target.targetShare : target.sourceShare,
		},
	};
};

const addRelationship = (
	index: AreaRelationshipIndex,
	area: string,
	relationship: AreaRelationship,
) => {
	const relationships = index.get(area) ?? [];
	relationships.push(relationship);
	index.set(area, relationships);
};

export const createAreaRelationshipIndex = (
	crosswalks: Iterable<CrosswalkArtifact>,
): AreaRelationshipIndex => {
	const index: AreaRelationshipIndex = new Map();
	for (const crosswalk of crosswalks) {
		const sourceTargetCounts = new Map<string, number>();
		const targetSourceCounts = new Map<string, number>();
		for (const record of crosswalk.records) {
			const sourceId = areaId(
				crosswalk.from.geography,
				crosswalk.from.boundaryRelease,
				record.source.code,
			);
			sourceTargetCounts.set(sourceId, record.targets.length);
			for (const target of record.targets) {
				const targetId = areaId(
					crosswalk.to.geography,
					crosswalk.to.boundaryRelease,
					target.code,
				);
				targetSourceCounts.set(
					targetId,
					(targetSourceCounts.get(targetId) ?? 0) + 1,
				);
			}
		}
		const crosswalkMetadata = {
			id: crosswalk.id,
			method: crosswalk.method,
			quality: crosswalk.quality,
			weighting: crosswalk.weighting,
		};
		for (const record of crosswalk.records) {
			const sourceId = areaId(
				crosswalk.from.geography,
				crosswalk.from.boundaryRelease,
				record.source.code,
			);
			for (const target of record.targets) {
				const targetId = areaId(
					crosswalk.to.geography,
					crosswalk.to.boundaryRelease,
					target.code,
				);
				const cardinality = {
					sourceTargetCount: sourceTargetCounts.get(sourceId) ?? 0,
					targetSourceCount: targetSourceCounts.get(targetId) ?? 0,
				};
				addRelationship(index, sourceId, {
					relation: relationFor(crosswalk, target, "from", cardinality),
					counterpart: {
						id: targetId,
						geography: crosswalk.to.geography,
						boundaryRelease: crosswalk.to.boundaryRelease,
						code: target.code,
						labels: target.labels,
					},
					crosswalk: crosswalkMetadata,
					...overlapFor(crosswalk, target, "from"),
				});
				addRelationship(index, targetId, {
					relation: relationFor(crosswalk, target, "to", cardinality),
					counterpart: {
						id: sourceId,
						geography: crosswalk.from.geography,
						boundaryRelease: crosswalk.from.boundaryRelease,
						code: record.source.code,
						labels: record.source.labels,
					},
					crosswalk: crosswalkMetadata,
					...overlapFor(crosswalk, target, "to"),
				});
			}
		}
	}
	for (const relationships of index.values()) {
		relationships.sort((left, right) => {
			const relation = left.relation.localeCompare(right.relation);
			if (relation !== 0) return relation;
			const counterpart = left.counterpart.id.localeCompare(
				right.counterpart.id,
			);
			return counterpart !== 0
				? counterpart
				: left.crosswalk.id.localeCompare(right.crosswalk.id);
		});
	}
	return index;
};
