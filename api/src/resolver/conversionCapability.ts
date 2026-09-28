import type { AreaInventory, AreaLookup } from "../areaInventory";
import type { CapabilityStatus } from "../capability";
import type {
	RelationshipPath,
	RelationshipPurpose,
} from "../relationshipPaths";
import type { CrosswalkTranslator, GeographyEndpoint } from "./translation";
import { releaseKey } from "../geographyKeys";

export type RelationshipPathStepCoverage = {
	crosswalkId: string;
	direction: "forward" | "reverse";
	status: "complete" | "partial" | "not-built";
	mappedSourceAreaCount?: number;
	sourceAreaCount?: number;
	share?: number;
	missingPrerequisite?: string;
};

export type ResolvedRelationshipPath = RelationshipPath & {
	/** Deterministic preference among paths for the same conversion request. */
	rank: {
		position: number;
		reasons: string[];
	};
	operations: {
		permitted: string[];
		prohibited: string[];
		note: string;
	};
	trust: {
		level: "verified" | "derived" | "partial" | "not-built";
		reasons: string[];
	};
	coverage: {
		status: "complete" | "partial" | "not-built";
		mappedSourceAreaCount?: number;
		sourceAreaCount?: number;
		share?: number;
		steps: RelationshipPathStepCoverage[];
	};
};

export const RELATIONSHIP_OPERATIONS = [
	"identity-join",
	"code-translation",
	"containment-aggregation",
	"membership-join",
	"weighted-allocation",
] as const;

export type RelationshipOperation = (typeof RELATIONSHIP_OPERATIONS)[number];

export type RelationshipPrerequisite = {
	id:
		| "source-areas"
		| "target-areas"
		| "path-step-areas"
		| "crosswalk-artifact"
		| "relationship-path";
	status: Extract<CapabilityStatus, "not-built" | "unsupported">;
	reason: string;
};

export type ResolvedRelationshipCapability = {
	status: Extract<
		CapabilityStatus,
		"available" | "partial" | "unsupported" | "not-built"
	>;
	paths: ResolvedRelationshipPath[];
	missingPrerequisites: RelationshipPrerequisite[];
};

/** A deterministic, inspectable choice for a requested geography conversion. */
export type ResolvedConversionPlan = {
	status: Extract<
		CapabilityStatus,
		"available" | "partial" | "unsupported" | "not-built"
	>;
	purpose: RelationshipPurpose;
	operation?: RelationshipOperation;
	selectedPath?: ResolvedRelationshipPath;
	alternatives: ResolvedRelationshipPath[];
	missingPrerequisites: RelationshipPrerequisite[];
	reason?: string;
};

/**
 * Where a release can actually carry data, which is not the same question as
 * whether its areas have relationships. A release whose only published paths
 * lead to other vintages of its own geography is joined up with its own
 * history and converts onto nothing new.
 */
export type GeographyReach = {
	status: "connected" | "vintage-only" | "isolated";
	/** Other geographies a published path converts this release onto. */
	reaches: string[];
	/** Other geographies a published path converts onto this release. */
	reachedFrom: string[];
	/** Paths to and from other vintages of this release's own geography. */
	vintagePathCount: number;
};

const operationsForPurpose = (
	purpose: RelationshipPurpose,
): ResolvedRelationshipPath["operations"] =>
	purpose === "identity"
		? {
				permitted: ["identity-join", "code-translation"],
				prohibited: ["weighted-allocation", "containment-aggregation"],
				note: "Use this path to identify the declared equivalent area; it does not supply weights or membership.",
			}
		: purpose === "membership"
			? {
					permitted: ["containment-aggregation", "membership-join"],
					prohibited: ["weighted-allocation"],
					note: "Use this path to group members under a parent. It does not allocate a source value across overlapping targets.",
				}
			: {
					permitted: ["weighted-allocation"],
					prohibited: ["identity-join"],
					note: "Use this path only for measures whose semantics permit the published overlap weighting.",
				};

type PathCoverageStatus = ResolvedRelationshipPath["coverage"]["status"];
type ResolvedPathCandidate = Omit<ResolvedRelationshipPath, "rank">;

const NOT_BUILT_REASON =
	"A required crosswalk or area identity artifact is not built.";
const DERIVED_STEP_REASON =
	"At least one path step is derived rather than publisher-supplied.";

/**
 * How far to trust a path: incomplete evidence caps it first, then an
 * unreviewed or derived route, and only complete publisher-supplied paths
 * are verified.
 */
export const assessPathTrust = (
	path: Pick<RelationshipPath, "origin" | "quality">,
	coverage: PathCoverageStatus,
): ResolvedRelationshipPath["trust"] => {
	if (coverage === "not-built")
		return { level: "not-built", reasons: [NOT_BUILT_REASON] };
	if (coverage === "partial")
		return {
			level: "partial",
			reasons: ["The declared path does not cover every source area."],
		};
	if (path.origin === "discovered")
		return {
			level: "derived",
			reasons: [
				"The build's path search composed this path under its composition rules; no one has reviewed it.",
				...(path.quality === "derived" ? [DERIVED_STEP_REASON] : []),
			],
		};
	if (path.quality === "derived")
		return { level: "derived", reasons: [DERIVED_STEP_REASON] };
	return {
		level: "verified",
		reasons: [
			"Every path step is publisher-supplied and has complete compiled coverage.",
		],
	};
};

/**
 * Deterministic preference among assessed paths: coverage, then evidence,
 * then how the path was declared, then length.
 */
export const rankResolvedPaths = (
	paths: readonly ResolvedPathCandidate[],
): ResolvedRelationshipPath[] => {
	const coverageOrder = { complete: 0, partial: 1, "not-built": 2 } as const;
	const trustOrder = {
		verified: 0,
		derived: 1,
		partial: 2,
		"not-built": 3,
	} as const;
	const originOrder = { crosswalk: 0, declared: 1, discovered: 2 } as const;
	return [...paths]
		.sort(
			(left, right) =>
				coverageOrder[left.coverage.status] -
					coverageOrder[right.coverage.status] ||
				trustOrder[left.trust.level] - trustOrder[right.trust.level] ||
				originOrder[left.origin] - originOrder[right.origin] ||
				left.steps.length - right.steps.length ||
				left.id.localeCompare(right.id),
		)
		.map((path, index) => ({
			...path,
			rank: {
				position: index + 1,
				reasons: [
					`${path.coverage.status} source coverage`,
					`${path.trust.level} evidence`,
					`${path.origin} path`,
					`${path.steps.length} ${path.steps.length === 1 ? "step" : "steps"}`,
				],
			},
		}));
};

/** The best coverage any path achieves decides the conversion's status. */
export const capabilityStatus = (
	paths: readonly Pick<ResolvedRelationshipPath, "coverage">[],
	missingPrerequisites: readonly RelationshipPrerequisite[],
): ResolvedRelationshipCapability["status"] => {
	if (paths.length === 0)
		return missingPrerequisites.some((item) => item.status === "not-built")
			? "not-built"
			: "unsupported";
	if (paths.some((path) => path.coverage.status === "complete"))
		return "available";
	if (paths.some((path) => path.coverage.status === "partial"))
		return "partial";
	return "not-built";
};

/**
 * Choose the best assessed path for an exact conversion without executing
 * it. The selected path is the first deterministic rank, and every other
 * usable or incomplete option remains visible as an alternative.
 */
export const planConversion = (
	capability: ResolvedRelationshipCapability,
	purpose: RelationshipPurpose,
	operation?: RelationshipOperation,
): ResolvedConversionPlan => {
	const [selectedPath, ...alternatives] = capability.paths;
	const operationPermitted =
		!operation ||
		!selectedPath ||
		selectedPath.operations.permitted.includes(operation);
	const status = operationPermitted ? capability.status : "unsupported";
	const reason = !operationPermitted
		? `${operation} is not permitted for a ${purpose} conversion; the selected path permits ${selectedPath!.operations.permitted.join(" and ")} instead.`
		: status === "available"
			? undefined
			: (capability.missingPrerequisites[0]?.reason ??
				(status === "partial"
					? "The best published path does not cover every source area."
					: "No published conversion path can satisfy this request."));
	return {
		status,
		purpose,
		...(operation ? { operation } : {}),
		...(selectedPath ? { selectedPath } : {}),
		alternatives,
		missingPrerequisites: capability.missingPrerequisites,
		...(reason ? { reason } : {}),
	};
};

/**
 * What each release can convert onto, and be converted from, by published
 * path. The answer for one release depends on every path in the inventory.
 */
export const buildConversionReach = (
	pathGroups: Iterable<readonly RelationshipPath[]>,
): Map<string, GeographyReach> => {
	const reach = new Map<string, GeographyReach>();
	const entry = (geography: string, boundaryRelease: string) => {
		const key = releaseKey(geography, boundaryRelease);
		const existing = reach.get(key);
		if (existing) return existing;
		const created: GeographyReach = {
			status: "isolated",
			reaches: [],
			reachedFrom: [],
			vintagePathCount: 0,
		};
		reach.set(key, created);
		return created;
	};
	const add = (into: string[], geography: string) => {
		if (!into.includes(geography)) into.push(geography);
	};
	for (const paths of pathGroups) {
		for (const path of paths) {
			const source = entry(
				path.from.geography,
				path.from.boundaryRelease,
			);
			const target = entry(path.to.geography, path.to.boundaryRelease);
			// A path between two vintages of one geography is continuity. It
			// keeps a code's history joined up without reaching anything new.
			if (path.from.geography === path.to.geography) {
				source.vintagePathCount += 1;
				target.vintagePathCount += 1;
				continue;
			}
			add(source.reaches, path.to.geography);
			add(target.reachedFrom, path.from.geography);
		}
	}
	for (const found of reach.values()) {
		found.reaches.sort();
		found.reachedFrom.sort();
		found.status =
			found.reaches.length > 0 || found.reachedFrom.length > 0
				? "connected"
				: found.vintagePathCount > 0
					? "vintage-only"
					: "isolated";
	}
	return reach;
};

/** Collects each missing prerequisite once, in the order it was found. */
class PrerequisiteLog {
	readonly items: RelationshipPrerequisite[] = [];

	add(item: RelationshipPrerequisite) {
		if (!this.items.some((existing) => existing.reason === item.reason))
			this.items.push(item);
		return item.reason;
	}
}

const areasMissingReason = (endpoint: GeographyEndpoint) =>
	`No compiled area identity artifact is available for ${endpoint.geography}/${endpoint.boundaryRelease}.`;

export type ConversionCapabilityInputs = {
	areaLookup?: AreaLookup;
	areaInventory?: AreaInventory;
	relationshipPathIndex?: Map<string, RelationshipPath[]>;
};

/**
 * Whether, how well and by which published path one release converts onto
 * another. It assesses paths without executing them; the translator owns the
 * crosswalk indexes both share.
 */
export class ConversionCapabilities {
	private reachByRelease?: Map<string, GeographyReach>;

	constructor(
		private readonly inputs: ConversionCapabilityInputs,
		private readonly translator: CrosswalkTranslator,
	) {}

	/** Compiled area count, falling back to the inventory when not loaded. */
	private areaCount(endpoint: GeographyEndpoint): number | undefined {
		const lookupCount = this.inputs.areaLookup?.get(
			releaseKey(endpoint.geography, endpoint.boundaryRelease),
		)?.size;
		if (lookupCount !== undefined) return lookupCount;
		const release = this.inputs.areaInventory?.releases.find(
			(candidate) =>
				candidate.geography === endpoint.geography &&
				candidate.id === endpoint.boundaryRelease,
		);
		return release?.status === "available"
			? release.recordCount
			: undefined;
	}

	/** How much of each step's source release its crosswalk maps. */
	private stepCoverage(
		path: RelationshipPath,
		step: RelationshipPath["steps"][number],
		missing: PrerequisiteLog,
	): RelationshipPathStepCoverage {
		const { crosswalkId, direction } = step;
		const artifact = this.translator.artifact(crosswalkId);
		if (!artifact) {
			const reason = missing.add({
				id: "crosswalk-artifact",
				status: "not-built",
				reason: `The crosswalk artifact ${crosswalkId} required by ${path.id} is not built.`,
			});
			return {
				crosswalkId,
				direction,
				status: "not-built",
				missingPrerequisite: reason,
			};
		}
		const mappedSourceAreaCount = this.translator.stepTargets(
			artifact,
			direction,
		).size;
		const stepSource =
			direction === "forward" ? artifact.from : artifact.to;
		const sourceAreaCount = this.areaCount(stepSource);
		if (sourceAreaCount === undefined) {
			const reason = missing.add({
				id: "path-step-areas",
				status: "not-built",
				reason: areasMissingReason(stepSource),
			});
			return {
				crosswalkId,
				direction,
				status: "not-built",
				mappedSourceAreaCount,
				missingPrerequisite: reason,
			};
		}
		const share = mappedSourceAreaCount / sourceAreaCount;
		return {
			crosswalkId,
			direction,
			status: share === 1 ? "complete" : "partial",
			mappedSourceAreaCount,
			sourceAreaCount,
			share,
		};
	}

	private assessPath(
		path: RelationshipPath,
		sourceAreaCount: number | undefined,
		missing: PrerequisiteLog,
	): ResolvedPathCandidate {
		const steps = path.steps.map((step) =>
			this.stepCoverage(path, step, missing),
		);
		// A composed path loses whatever any step drops, so its coverage is the
		// share of source areas that reach the target through every step.
		const reached = steps.some((step) => step.status === "not-built")
			? undefined
			: this.translator.pathReach(path, path.from);
		const share =
			reached !== undefined && sourceAreaCount
				? reached / sourceAreaCount
				: undefined;
		const status: PathCoverageStatus =
			reached === undefined
				? "not-built"
				: share === 1
					? "complete"
					: "partial";
		return {
			...path,
			operations: operationsForPurpose(path.purpose),
			trust: assessPathTrust(path, status),
			coverage: {
				status,
				mappedSourceAreaCount: reached,
				sourceAreaCount,
				share,
				steps,
			},
		};
	}

	/**
	 * Explains whether an exact conversion is usable, including the source
	 * coverage of each declared path and every artifact that is still needed to
	 * make that claim. This keeps route handlers out of crosswalk internals.
	 */
	relationshipCapability(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
	): ResolvedRelationshipCapability {
		const missing = new PrerequisiteLog();
		const sourceAreaCount = this.areaCount(from);
		if (sourceAreaCount === undefined)
			missing.add({
				id: "source-areas",
				status: "not-built",
				reason: areasMissingReason(from),
			});
		if (this.areaCount(to) === undefined)
			missing.add({
				id: "target-areas",
				status: "not-built",
				reason: areasMissingReason(to),
			});
		const paths = this.translator.publishedPaths(from, to, purpose);
		if (paths.length === 0)
			missing.add({
				id: "relationship-path",
				status: "unsupported",
				reason: `No declared ${purpose} path is published from ${from.geography}/${from.boundaryRelease} to ${to.geography}/${to.boundaryRelease}.`,
			});
		const rankedPaths = rankResolvedPaths(
			paths.map((path) =>
				this.assessPath(path, sourceAreaCount, missing),
			),
		);
		return {
			status: capabilityStatus(rankedPaths, missing.items),
			paths: rankedPaths,
			missingPrerequisites: missing.items,
		};
	}

	conversionPlan(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
		operation?: RelationshipOperation,
	): ResolvedConversionPlan {
		return planConversion(
			this.relationshipCapability(from, to, purpose),
			purpose,
			operation,
		);
	}

	/** Every declared conversion starting at one exact release, grouped safely by endpoint and purpose. */
	relationshipCapabilitiesFrom(from: GeographyEndpoint) {
		const discovered = new Map<
			string,
			{ to: GeographyEndpoint; purpose: RelationshipPurpose }
		>();
		for (const paths of this.inputs.relationshipPathIndex?.values() ?? []) {
			for (const path of paths) {
				if (
					path.from.geography !== from.geography ||
					path.from.boundaryRelease !== from.boundaryRelease
				)
					continue;
				const key = [
					path.to.geography,
					path.to.boundaryRelease,
					path.purpose,
				].join("/");
				discovered.set(key, { to: path.to, purpose: path.purpose });
			}
		}
		return [...discovered.values()]
			.map(({ to, purpose }) => ({
				to,
				purpose,
				...this.relationshipCapability(from, to, purpose),
			}))
			.sort((left, right) =>
				[left.to.geography, left.to.boundaryRelease, left.purpose]
					.join("/")
					.localeCompare(
						[
							right.to.geography,
							right.to.boundaryRelease,
							right.purpose,
						].join("/"),
					),
			);
	}

	/** Built once, because the answer for one release depends on every path. */
	conversionReach(): Map<string, GeographyReach> {
		this.reachByRelease ??= buildConversionReach(
			this.inputs.relationshipPathIndex?.values() ?? [],
		);
		return this.reachByRelease;
	}
}
