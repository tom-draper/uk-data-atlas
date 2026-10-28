import type { CrosswalkArtifact } from "./crosswalkTypes";
import type {
	CrosswalkMethod,
	CrosswalkQuality,
	CrosswalkWeighting,
} from "./crosswalkInventory";
import { areaKey, releaseKey } from "@uk-data-atlas/geography";
import { relatedCodesOf } from "./relatedCodes";
import { selectCrosswalks, type CrosswalkLookup } from "./translation";

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

const AREA_RELATIONS: AreaRelation[] = [
	"within",
	"contains",
	"successor",
	"predecessor",
	"split-from",
	"merged-from",
	"equivalent-to",
	"overlaps",
];

/**
 * Every relation a crosswalk can state of an area on one side of it, which
 * its header settles before any record is read. It follows `relationFor`
 * branch for branch: `from` is what a source is to its targets, and `to` what
 * a target is to its sources.
 */
export const relationsOf = (
	{
		method,
		relationshipPurpose,
	}: Pick<CrosswalkArtifact, "method" | "relationshipPurpose">,
	side: "from" | "to",
): readonly AreaRelation[] => {
	if (method === "best-fit")
		return side === "from"
			? ["within", "overlaps"]
			: ["contains", "overlaps"];
	if (
		method === "clean-containment" ||
		method === "geometric-containment" ||
		relationshipPurpose === "membership"
	)
		return side === "from" ? ["within"] : ["contains"];
	if (method === "area-overlap" || method === "population-overlap")
		return ["overlaps"];
	if (method === "extent-continuity") return ["equivalent-to"];
	return side === "from"
		? ["successor"]
		: ["split-from", "merged-from", "predecessor"];
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

type CrosswalkRecord = CrosswalkArtifact["records"][number];
type CrosswalkTarget = CrosswalkRecord["targets"][number];
type Cardinality = { sourceTargetCount: number; targetSourceCount: number };

const metadataOf = (
	crosswalk: CrosswalkArtifact,
): AreaRelationship["crosswalk"] => ({
	id: crosswalk.id,
	method: crosswalk.method,
	quality: crosswalk.quality,
	weighting: crosswalk.weighting,
});

/** What a record's source is to one of its targets. */
const sourceRelationship = (
	crosswalk: CrosswalkArtifact,
	metadata: AreaRelationship["crosswalk"],
	target: CrosswalkTarget,
	targetId: string,
	cardinality: Cardinality,
): AreaRelationship => ({
	relation: relationFor(crosswalk, target, "from", cardinality),
	counterpart: {
		id: targetId,
		geography: crosswalk.to.geography,
		boundaryRelease: crosswalk.to.boundaryRelease,
		code: target.code,
		labels: target.labels,
	},
	crosswalk: metadata,
	...overlapFor(crosswalk, target, "from"),
});

/** What a record's target is to its source. */
const targetRelationship = (
	crosswalk: CrosswalkArtifact,
	metadata: AreaRelationship["crosswalk"],
	record: CrosswalkRecord,
	target: CrosswalkTarget,
	sourceId: string,
	cardinality: Cardinality,
): AreaRelationship => ({
	relation: relationFor(crosswalk, target, "to", cardinality),
	counterpart: {
		id: sourceId,
		geography: crosswalk.from.geography,
		boundaryRelease: crosswalk.from.boundaryRelease,
		code: record.source.code,
		labels: record.source.labels,
	},
	crosswalk: metadata,
	...overlapFor(crosswalk, target, "to"),
});

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
	const crosswalkMetadata = metadataOf(crosswalk);
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
			addRelationship(
				index,
				sourceId,
				sourceRelationship(
					crosswalk,
					crosswalkMetadata,
					target,
					targetId,
					cardinality,
				),
			);
			addRelationship(
				index,
				targetId,
				targetRelationship(
					crosswalk,
					crosswalkMetadata,
					record,
					target,
					sourceId,
					cardinality,
				),
			);
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
 * Where each code sits in a crosswalk's records: the records a source code
 * heads, and for a target code each record and position it appears at, as
 * consecutive pairs. It is all the lazy index keeps of a crosswalk, so one
 * area's relationships are built without building every other area's.
 */
type CrosswalkPositions = {
	sources: Map<string, number[]>;
	targets: Map<string, number[]>;
};

const positionsIn = ({ records }: CrosswalkArtifact): CrosswalkPositions => {
	const sources = new Map<string, number[]>();
	const targets = new Map<string, number[]>();
	for (let position = 0; position < records.length; position += 1) {
		const record = records[position]!;
		const heads = sources.get(record.source.code);
		if (heads) heads.push(position);
		else sources.set(record.source.code, [position]);
		for (let at = 0; at < record.targets.length; at += 1) {
			const code = record.targets[at]!.code;
			const pairs = targets.get(code);
			if (pairs) pairs.push(position, at);
			else targets.set(code, [position, at]);
		}
	}
	return { sources, targets };
};

/**
 * The same relationships as `createAreaRelationshipIndex`, built a release at
 * a time. An area's relationships come only from the crosswalks that name its
 * release, so answering for one reads those and no others; the rest of the
 * graph is never parsed unless something asks for it. Of those crosswalks it
 * keeps where each code sits, and builds relationships only for the area asked
 * about: building every area's held hundreds of megabytes after one request.
 * Each area's list is ordered as the eager index orders it, whatever order
 * releases are asked in.
 */
export class LazyAreaRelationshipIndex {
	private readonly touching = new Map<string, CrosswalkArtifact[]>();
	private readonly positions = new Map<string, CrosswalkPositions>();
	private readonly areas = new Map<string, AreaRelationship[]>();
	private readonly followed = new Map<string, AreaRelationship[]>();

	constructor(private readonly lookup: CrosswalkLookup) {}

	/**
	 * An area's relationships, or with `follow` only those of the relations
	 * it admits. A crosswalk's header says which relations it can state, so a
	 * filtered lookup reads only the crosswalks that could answer it: an
	 * area's lineage is in a few small files, and its memberships in large
	 * ones a history never needs. Which side of a crosswalk the area is on
	 * matters too: its parents are in the crosswalks it is a source of, and
	 * its children in those it is a target of.
	 */
	get(
		area: string,
		follow?: (relation: AreaRelation) => boolean,
	): AreaRelationship[] | undefined {
		const all = this.areas.get(area);
		if (follow && !all) return this.following(area, follow);
		const relationships = all ?? this.relationshipsOf(area);
		if (!all) this.areas.set(area, relationships);
		const found = follow
			? relationships.filter(({ relation }) => follow(relation))
			: relationships;
		return found.length > 0 ? found : undefined;
	}

	private following(
		area: string,
		follow: (relation: AreaRelation) => boolean,
	): AreaRelationship[] | undefined {
		const admitted = AREA_RELATIONS.filter(follow);
		const key = `${area}\u0000${admitted.join(",")}`;
		let relationships = this.followed.get(key);
		if (!relationships) {
			relationships = this.relationshipsOf(area, admitted).filter(
				({ relation }) => follow(relation),
			);
			this.followed.set(key, relationships);
		}
		return relationships.length > 0 ? relationships : undefined;
	}

	/** Built from every crosswalk naming the area's release, or those that can state `admitted`. */
	private relationshipsOf(
		area: string,
		admitted?: AreaRelation[],
	): AreaRelationship[] {
		// An area key is geography/release/code; neither of the first two
		// holds a slash, and a code may.
		const [geography, boundaryRelease] = area.split("/", 2) as [
			string,
			string,
		];
		const code = area.slice(
			releaseKey(geography, boundaryRelease).length + 1,
		);
		return this.crosswalksFor(geography, boundaryRelease, admitted)
			.flatMap((crosswalk) =>
				this.relationshipsIn(
					crosswalk,
					geography,
					boundaryRelease,
					code,
				),
			)
			.sort(compareRelationships);
	}

	/**
	 * The codes of a release's areas that `get` answers for, read from the
	 * crosswalk records without building a relationship for any of them. A
	 * count of related areas needs no more, and building every relationship
	 * of every release holds a gigabyte of objects it would never read.
	 */
	relatedCodes(geography: string, boundaryRelease: string): Set<string> {
		const codes = new Set<string>();
		for (const crosswalk of this.crosswalksFor(
			geography,
			boundaryRelease,
		)) {
			const { source, target } = relatedCodesOf(crosswalk);
			const from = crosswalk.from;
			const to = crosswalk.to;
			if (
				from.geography === geography &&
				from.boundaryRelease === boundaryRelease
			)
				for (const code of source) codes.add(code);
			if (
				to.geography === geography &&
				to.boundaryRelease === boundaryRelease
			)
				for (const code of target) codes.add(code);
		}
		return codes;
	}

	/**
	 * The crosswalks naming a release, in inventory order: all of them, or
	 * only those able to state one of the `admitted` relations.
	 */
	private crosswalksFor(
		geography: string,
		boundaryRelease: string,
		admitted?: AreaRelation[],
	) {
		const release = releaseKey(geography, boundaryRelease);
		const key = admitted
			? `${release}\u0000${admitted.join(",")}`
			: release;
		let crosswalks = this.touching.get(key);
		if (!crosswalks) {
			const names = (side: CrosswalkArtifact["from"]) =>
				side.geography === geography &&
				side.boundaryRelease === boundaryRelease;
			crosswalks = selectCrosswalks(this.lookup, (header) =>
				(["from", "to"] as const).some(
					(side) =>
						names(header[side]) &&
						(!admitted ||
							relationsOf(header, side).some((relation) =>
								admitted.includes(relation),
							)),
				),
			);
			this.touching.set(key, crosswalks);
		}
		return crosswalks;
	}

	/**
	 * One area's relationships from one crosswalk, in the order the eager
	 * index adds them: by record, then by target, the source's before the
	 * target's.
	 */
	private relationshipsIn(
		crosswalk: CrosswalkArtifact,
		geography: string,
		boundaryRelease: string,
		code: string,
	): AreaRelationship[] {
		const { from, to, records } = crosswalk;
		const positions = this.positionsOf(crosswalk);
		const metadata = metadataOf(crosswalk);
		const cardinalityOf = (
			record: CrosswalkRecord,
			target: CrosswalkTarget,
		): Cardinality => ({
			// A source in two records counts as the eager index counts it:
			// by the last of them.
			sourceTargetCount:
				records[positions.sources.get(record.source.code)!.at(-1)!]!
					.targets.length,
			targetSourceCount: positions.targets.get(target.code)!.length / 2,
		});
		const found: Array<[number, number, 0 | 1, AreaRelationship]> = [];
		if (
			from.geography === geography &&
			from.boundaryRelease === boundaryRelease
		)
			for (const position of positions.sources.get(code) ?? []) {
				const record = records[position]!;
				record.targets.forEach((target, targetPosition) =>
					found.push([
						position,
						targetPosition,
						0,
						sourceRelationship(
							crosswalk,
							metadata,
							target,
							areaId(
								to.geography,
								to.boundaryRelease,
								target.code,
							),
							cardinalityOf(record, target),
						),
					]),
				);
			}
		const asSource = found.length;
		if (
			to.geography === geography &&
			to.boundaryRelease === boundaryRelease
		) {
			const pairs = positions.targets.get(code) ?? [];
			for (let pair = 0; pair < pairs.length; pair += 2) {
				const record = records[pairs[pair]!]!;
				const target = record.targets[pairs[pair + 1]!]!;
				found.push([
					pairs[pair]!,
					pairs[pair + 1]!,
					1,
					targetRelationship(
						crosswalk,
						metadata,
						record,
						target,
						areaId(
							from.geography,
							from.boundaryRelease,
							record.source.code,
						),
						cardinalityOf(record, target),
					),
				]);
			}
		}
		// Only a crosswalk within one release can name an area on both sides.
		if (asSource > 0 && found.length > asSource)
			found.sort(
				(left, right) =>
					left[0] - right[0] ||
					left[1] - right[1] ||
					left[2] - right[2],
			);
		return found.map(([, , , relationship]) => relationship);
	}

	private positionsOf(crosswalk: CrosswalkArtifact) {
		let positions = this.positions.get(crosswalk.id);
		if (!positions) {
			positions = positionsIn(crosswalk);
			this.positions.set(crosswalk.id, positions);
		}
		return positions;
	}
}
