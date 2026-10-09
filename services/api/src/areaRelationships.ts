import type {
	CrosswalkArtifact,
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkWeighting,
} from "./crosswalkInventory";
import { areaKey, releaseKey } from "./geographyKeys";
import { selectCrosswalks, type CrosswalkLookup } from "./resolver/translation";

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

/** Add what one crosswalk says about each area on either side of it. */
const addCrosswalkRelationships = (
	index: AreaRelationshipIndex,
	crosswalk: CrosswalkArtifact,
) => {
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
};

const compareRelationships = (
	left: AreaRelationship,
	right: AreaRelationship,
) => {
	const relation = left.relation.localeCompare(right.relation);
	if (relation !== 0) return relation;
	const counterpart = left.counterpart.id.localeCompare(right.counterpart.id);
	return counterpart !== 0
		? counterpart
		: left.crosswalk.id.localeCompare(right.crosswalk.id);
};

export const createAreaRelationshipIndex = (
	crosswalks: Iterable<CrosswalkArtifact>,
): AreaRelationshipIndex => {
	const index: AreaRelationshipIndex = new Map();
	for (const crosswalk of crosswalks)
		addCrosswalkRelationships(index, crosswalk);
	for (const relationships of index.values())
		relationships.sort(compareRelationships);
	return index;
};

/**
 * The same relationships as `createAreaRelationshipIndex`, built a release at
 * a time. An area's relationships come only from the crosswalks that name its
 * release, so answering for one reads those and no others; the rest of the
 * graph is never parsed unless something asks for it. Each area's list is
 * ordered as the eager index orders it, whatever order releases are asked in.
 */
export class LazyAreaRelationshipIndex {
	private readonly touching = new Map<string, CrosswalkArtifact[]>();
	private readonly contributions = new Map<string, AreaRelationshipIndex>();
	private readonly areas = new Map<string, AreaRelationship[]>();

	constructor(private readonly lookup: CrosswalkLookup) {}

	get(area: string): AreaRelationship[] | undefined {
		let relationships = this.areas.get(area);
		if (!relationships) {
			// An area key is geography/release/code; neither of the first two
			// holds a slash, and a code may.
			const [geography, boundaryRelease] = area.split("/", 2) as [
				string,
				string,
			];
			relationships = this.crosswalksFor(
				geography,
				boundaryRelease,
			).flatMap(
				(crosswalk) => this.contributionOf(crosswalk).get(area) ?? [],
			);
			relationships.sort(compareRelationships);
			this.areas.set(area, relationships);
		}
		return relationships.length > 0 ? relationships : undefined;
	}

	/**
	 * The codes of a release's areas that `get` answers for, read from the
	 * crosswalk records without building a relationship for any of them. A
	 * count of related areas needs no more, and building every relationship
	 * of every release holds a gigabyte of objects it would never read.
	 */
	relatedCodes(geography: string, boundaryRelease: string): Set<string> {
		const names = (side: CrosswalkArtifact["from"]) =>
			side.geography === geography &&
			side.boundaryRelease === boundaryRelease;
		const codes = new Set<string>();
		for (const crosswalk of this.crosswalksFor(
			geography,
			boundaryRelease,
		)) {
			const source = names(crosswalk.from);
			const target = names(crosswalk.to);
			for (const record of crosswalk.records) {
				// A source with no targets is named by no relationship.
				if (source && record.targets.length > 0)
					codes.add(record.source.code);
				if (target)
					for (const { code } of record.targets) codes.add(code);
			}
		}
		return codes;
	}

	/** The crosswalks naming a release, in inventory order. */
	private crosswalksFor(geography: string, boundaryRelease: string) {
		const release = releaseKey(geography, boundaryRelease);
		let crosswalks = this.touching.get(release);
		if (!crosswalks) {
			const names = (side: CrosswalkArtifact["from"]) =>
				side.geography === geography &&
				side.boundaryRelease === boundaryRelease;
			crosswalks = selectCrosswalks(
				this.lookup,
				({ from, to }) => names(from) || names(to),
			);
			this.touching.set(release, crosswalks);
		}
		return crosswalks;
	}

	private contributionOf(crosswalk: CrosswalkArtifact) {
		let contribution = this.contributions.get(crosswalk.id);
		if (!contribution) {
			contribution = new Map();
			addCrosswalkRelationships(contribution, crosswalk);
			this.contributions.set(crosswalk.id, contribution);
		}
		return contribution;
	}
}
