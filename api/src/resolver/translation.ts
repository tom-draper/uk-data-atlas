import type { AreaLookup } from "../areaInventory";
import type { CrosswalkArtifact } from "../crosswalkInventory";
import {
	relationshipPurposeFor,
	type RelationshipPath,
	type RelationshipPurpose,
} from "../relationshipPaths";

export type CrosswalkLookup = Map<string, CrosswalkArtifact>;
export type GeographyEndpoint = { geography: string; boundaryRelease: string };
export type AreaIdentity = GeographyEndpoint & { code: string };
export type StepDirection = "forward" | "reverse";

type CrosswalkSource = CrosswalkArtifact["records"][number]["source"];
type CrosswalkTarget = CrosswalkArtifact["records"][number]["targets"][number];
type OverlapCrosswalkArtifact = Extract<
	CrosswalkArtifact,
	{ method: "area-overlap" | "population-overlap" }
>;
type OverlapCrosswalkTarget =
	OverlapCrosswalkArtifact["records"][number]["targets"][number];
export type TranslationTarget = CrosswalkSource | CrosswalkTarget;
export type TranslationStep = {
	source: CrosswalkSource;
	targets: TranslationTarget[];
	sourceCoverage?: number;
};

export type ResolvedAreaTranslation = {
	/** The published direct or composed route that produced these targets. */
	path: RelationshipPath;
	source: CrosswalkSource;
	targets: TranslationTarget[];
	/** Present when a reverse overlap route was normalised to the queried area. */
	sourceCoverage?: number;
};

const endpointKey = (endpoint: GeographyEndpoint) =>
	`${endpoint.geography}/${endpoint.boundaryRelease}`;

const sameEndpoint = (left: GeographyEndpoint, right: GeographyEndpoint) =>
	left.geography === right.geography &&
	left.boundaryRelease === right.boundaryRelease;

export const directRelationshipPath = (
	crosswalk: CrosswalkArtifact,
	direction: StepDirection,
	purpose: RelationshipPurpose,
): RelationshipPath => ({
	id: `${crosswalk.id}/${direction}/${purpose}`,
	purpose,
	from: direction === "forward" ? crosswalk.from : crosswalk.to,
	to: direction === "forward" ? crosswalk.to : crosswalk.from,
	quality: crosswalk.quality,
	origin: "crosswalk",
	steps: [
		{
			crosswalkId: crosswalk.id,
			direction,
			method: crosswalk.method,
			purpose,
		},
	],
});

/** One-step paths from loaded crosswalks, in either direction. */
export const directTranslationPaths = (
	crosswalks: Iterable<CrosswalkArtifact>,
	from: GeographyEndpoint,
	to: GeographyEndpoint,
	purpose: RelationshipPurpose,
): RelationshipPath[] =>
	[...crosswalks].flatMap((crosswalk) => {
		if (relationshipPurposeFor(crosswalk) !== purpose) return [];
		if (sameEndpoint(crosswalk.from, from) && sameEndpoint(crosswalk.to, to))
			return [directRelationshipPath(crosswalk, "forward", purpose)];
		if (sameEndpoint(crosswalk.to, from) && sameEndpoint(crosswalk.from, to))
			return [directRelationshipPath(crosswalk, "reverse", purpose)];
		return [];
	});

/**
 * Deterministic preference for executing a translation: single published
 * crosswalks first, then reviewed and then discovered compositions, favouring
 * publisher-supplied evidence and shorter routes.
 */
export const rankTranslationPaths = (
	paths: readonly RelationshipPath[],
): RelationshipPath[] => {
	const origin = { crosswalk: 0, declared: 1, discovered: 2 } as const;
	const quality = { "publisher-supplied": 0, derived: 1 } as const;
	return [...paths].sort(
		(left, right) =>
			origin[left.origin] - origin[right.origin] ||
			quality[left.quality] - quality[right.quality] ||
			left.steps.length - right.steps.length ||
			left.id.localeCompare(right.id),
	);
};

/**
 * Index one crosswalk direction by source code. A reversed overlap is
 * normalised so each queried area's weights sum to 1 over the share of it the
 * published sources cover, which is reported as `sourceCoverage`.
 */
export const buildTranslationSteps = (
	artifact: CrosswalkArtifact,
	direction: StepDirection,
): Map<string, TranslationStep> => {
	const steps = new Map<string, TranslationStep>();
	if (direction === "forward") {
		for (const record of artifact.records)
			steps.set(record.source.code, {
				source: record.source,
				targets: record.targets,
			});
	} else if (
		artifact.method === "area-overlap" ||
		artifact.method === "population-overlap"
	) {
		const recordsByTarget = new Map<
			string,
			Array<{
				record: CrosswalkArtifact["records"][number];
				target: OverlapCrosswalkTarget;
			}>
		>();
		for (const record of artifact.records) {
			for (const target of record.targets) {
				const records = recordsByTarget.get(target.code) ?? [];
				records.push({ record, target });
				recordsByTarget.set(target.code, records);
			}
		}
		for (const [code, records] of recordsByTarget) {
			const sourceCoverage = records.reduce(
				(sum, { target }) => sum + target.targetShare,
				0,
			);
			if (sourceCoverage <= 0) continue;
			steps.set(code, {
				source: {
					code,
					labels: [
						...new Set(records.flatMap(({ target }) => target.labels)),
					].sort(),
				},
				sourceCoverage,
				targets: records.map(({ record, target }) => ({
					...record.source,
					weight: target.targetShare / sourceCoverage,
					overlapAreaM2: target.overlapAreaM2,
					sourceShare: target.targetShare,
					targetShare: target.sourceShare,
				})),
			});
		}
	} else {
		const targetsBySource = new Map<string, TranslationTarget[]>();
		const labelsBySource = new Map<string, string[]>();
		for (const record of artifact.records) {
			for (const target of record.targets) {
				const targets = targetsBySource.get(target.code) ?? [];
				targets.push(record.source);
				targetsBySource.set(target.code, targets);
				const labels = labelsBySource.get(target.code) ?? [];
				labels.push(...target.labels);
				labelsBySource.set(target.code, labels);
			}
		}
		for (const [code, targets] of targetsBySource)
			steps.set(code, {
				source: {
					code,
					labels: [...new Set(labelsBySource.get(code) ?? [])].sort(),
				},
				targets,
			});
	}
	return steps;
};

/** Each source code of one crosswalk direction and the codes it reaches. */
export const buildStepTargets = (
	artifact: CrosswalkArtifact,
	direction: StepDirection,
): Map<string, string[]> => {
	const targets = new Map<string, string[]>();
	for (const record of artifact.records) {
		for (const target of record.targets) {
			const [from, to] =
				direction === "forward"
					? [record.source.code, target.code]
					: [target.code, record.source.code];
			const reached = targets.get(from) ?? [];
			reached.push(to);
			targets.set(from, reached);
		}
	}
	return targets;
};

const weightOf = (target: TranslationTarget, missing: number) =>
	"weight" in target ? target.weight : missing;

/**
 * Carry one source code through every step of a path. Apportion weights
 * multiply along the route and sum where routes meet the same target; other
 * purposes only merge labels. `stepsFor` returns undefined when a step's
 * artifact is not loaded, which leaves the path without a result.
 */
export const executeTranslationPath = (
	path: RelationshipPath,
	sourceCode: string,
	stepsFor: (
		step: RelationshipPath["steps"][number],
	) => Map<string, TranslationStep> | undefined,
): ResolvedAreaTranslation | undefined => {
	const [first, ...rest] = path.steps;
	if (!first) return undefined;
	const firstStep = stepsFor(first)?.get(sourceCode);
	if (!firstStep) return undefined;
	// Direct paths keep the long-standing crosswalk response shape.
	if (rest.length === 0) return { path, ...firstStep };

	let targets = firstStep.targets;
	for (const step of rest) {
		const steps = stepsFor(step);
		if (!steps) return undefined;
		targets = targets.flatMap((target) => {
			const translated = steps.get(target.code);
			if (!translated) return [];
			return translated.targets.map((next) =>
				path.purpose === "apportion"
					? { ...next, weight: weightOf(target, 1) * weightOf(next, 1) }
					: next,
			);
		});
		if (targets.length === 0) return undefined;
	}
	const combined = new Map<string, TranslationTarget>();
	for (const target of targets) {
		const previous = combined.get(target.code);
		if (!previous) {
			combined.set(target.code, target);
			continue;
		}
		combined.set(target.code, {
			...previous,
			labels: [...new Set([...previous.labels, ...target.labels])].sort(),
			...(path.purpose === "apportion"
				? { weight: weightOf(previous, 0) + weightOf(target, 0) }
				: {}),
		});
	}
	return {
		path,
		source: firstStep.source,
		targets: [...combined.values()].sort((left, right) =>
			left.code.localeCompare(right.code),
		),
	};
};

export type CrosswalkTranslatorInputs = {
	crosswalkLookup?: CrosswalkLookup;
	relationshipPathIndex?: Map<string, RelationshipPath[]>;
	areaLookup?: AreaLookup;
};

/**
 * Executes area translations over published relationship paths. It owns the
 * per-crosswalk direction indexes so routes never scan crosswalk records.
 */
export class CrosswalkTranslator {
	private readonly translationStepCache = new Map<
		string,
		Map<string, TranslationStep>
	>();
	private readonly stepTargetCache = new Map<string, Map<string, string[]>>();
	private readonly pathReachCache = new Map<string, number>();

	constructor(private readonly inputs: CrosswalkTranslatorInputs) {}

	artifact(id: string): CrosswalkArtifact | undefined {
		return this.inputs.crosswalkLookup?.get(id);
	}

	publishedPaths(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
	): RelationshipPath[] {
		return (
			this.inputs.relationshipPathIndex?.get(
				[endpointKey(from), endpointKey(to), purpose].join("/"),
			) ?? []
		);
	}

	/**
	 * Published paths are the authority for a conversion. A small direct-path
	 * fallback keeps a translator useful when a consumer has loaded crosswalk
	 * artifacts but not the separately compiled path inventory, such as a
	 * focused test or an intentionally small deployment.
	 */
	paths(
		from: GeographyEndpoint,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
	): RelationshipPath[] {
		const published = this.publishedPaths(from, to, purpose);
		return rankTranslationPaths(
			published.length > 0
				? published
				: directTranslationPaths(
						this.inputs.crosswalkLookup?.values() ?? [],
						from,
						to,
						purpose,
					),
		);
	}

	/** Build each crosswalk direction once. */
	translationSteps(
		artifact: CrosswalkArtifact,
		direction: StepDirection,
	): Map<string, TranslationStep> {
		const key = `${artifact.id}/${direction}`;
		let steps = this.translationStepCache.get(key);
		if (!steps) {
			steps = buildTranslationSteps(artifact, direction);
			this.translationStepCache.set(key, steps);
		}
		return steps;
	}

	stepTargets(
		artifact: CrosswalkArtifact,
		direction: StepDirection,
	): Map<string, string[]> {
		const key = `${artifact.id}/${direction}`;
		let targets = this.stepTargetCache.get(key);
		if (!targets) {
			targets = buildStepTargets(artifact, direction);
			this.stepTargetCache.set(key, targets);
		}
		return targets;
	}

	/**
	 * Translate one exact area through every published path that has a result
	 * for it. A composed path carries its full route so callers can inspect
	 * every step.
	 */
	translateArea(
		source: AreaIdentity,
		to: GeographyEndpoint,
		purpose: RelationshipPurpose,
	): ResolvedAreaTranslation[] {
		return this.paths(source, to, purpose).flatMap((path) => {
			const translation = executeTranslationPath(path, source.code, (step) => {
				const artifact = this.artifact(step.crosswalkId);
				return artifact && this.translationSteps(artifact, step.direction);
			});
			return translation ? [translation] : [];
		});
	}

	/**
	 * How many of a path's source areas reach its target through every step.
	 * Walking back from the last step, each step keeps the codes with a target
	 * the next step still carries, so the pass is linear in the records.
	 */
	pathReach(path: RelationshipPath, from: GeographyEndpoint) {
		const cached = this.pathReachCache.get(path.id);
		if (cached !== undefined) return cached;
		let carried: Set<string> | undefined;
		for (const step of [...path.steps].reverse()) {
			const artifact = this.artifact(step.crosswalkId);
			if (!artifact) return undefined;
			const kept = new Set<string>();
			for (const [code, targets] of this.stepTargets(artifact, step.direction))
				if (!carried || targets.some((target) => carried!.has(target)))
					kept.add(code);
			carried = kept;
		}
		const sources = this.inputs.areaLookup?.get(endpointKey(from));
		const reach = sources
			? [...(carried ?? [])].filter((code) => sources.has(code)).length
			: (carried?.size ?? 0);
		this.pathReachCache.set(path.id, reach);
		return reach;
	}
}
