import type {
	CrosswalkArtifact,
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkWeighting,
} from "./crosswalkInventory";

export type AreaRelation =
	"within" | "contains" | "successor" | "predecessor" | "overlaps";

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
	[geography, boundaryRelease, code].join("/");

const relationFor = (
	method: CrosswalkMethod,
	direction: "from" | "to",
): AreaRelation => {
	if (method === "clean-containment") {
		return direction === "from" ? "within" : "contains";
	}
	if (method === "area-overlap") return "overlaps";
	return direction === "from" ? "successor" : "predecessor";
};

const overlapFor = (
	target: CrosswalkArtifact["records"][number]["targets"][number],
	direction: "from" | "to",
): { overlap?: AreaOverlap } => {
	if (!("overlapAreaM2" in target)) return {};
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
				addRelationship(index, sourceId, {
					relation: relationFor(crosswalk.method, "from"),
					counterpart: {
						id: targetId,
						geography: crosswalk.to.geography,
						boundaryRelease: crosswalk.to.boundaryRelease,
						code: target.code,
						labels: target.labels,
					},
					crosswalk: crosswalkMetadata,
					...overlapFor(target, "from"),
				});
				addRelationship(index, targetId, {
					relation: relationFor(crosswalk.method, "to"),
					counterpart: {
						id: sourceId,
						geography: crosswalk.from.geography,
						boundaryRelease: crosswalk.from.boundaryRelease,
						code: record.source.code,
						labels: record.source.labels,
					},
					crosswalk: crosswalkMetadata,
					...overlapFor(target, "to"),
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
