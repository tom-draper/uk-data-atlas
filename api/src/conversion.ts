import type { CrosswalkArtifact } from "./crosswalkInventory";
import type { PopulationObservation } from "./dataCatalog";
import {
	buildTranslationSteps,
	type IndexedPathStep,
	type TranslationStep,
} from "./resolver/translation";

/**
 * How a converted value was arrived at.
 *
 * `exact` means every source area sits wholly inside one target, so the
 * conversion is a regrouping and the total is unchanged. `area-weighted` means
 * a source was split across targets in proportion to overlapping area, which
 * is an estimate: it assumes the measure is spread evenly across the source,
 * and population and most social measures are not. `population-weighted`
 * means the split followed where the source's residents live, counted from
 * small building blocks, which assumes the measure follows population.
 */
/** How a crosswalk moves values: one to one, or split by a published weight. */
export const CONVERSION_METHODS = [
	"exact",
	"area-weighted",
	"population-weighted",
] as const;

export type ConversionMethod = (typeof CONVERSION_METHODS)[number];

export type ConvertedObservation = {
	areaCode: string;
	value: number;
	status: "derived";
	/** How many source areas contributed to this target. */
	inputAreaCount: number;
};

export type ConversionResult =
	| {
			status: "converted";
			method: ConversionMethod;
			records: ConvertedObservation[];
			inputRecordCount: number;
	  }
	| {
			status: "refused";
			/** Why no defensible conversion exists, for a machine to act on. */
			absence: "source-areas-not-mapped" | "unweighted-split";
			reason: string;
			areaCount: number;
			/** The first affected source codes, in partition order. */
			areaSample: string[];
	  };

export type ConversionStep = IndexedPathStep;

type Refusal = Extract<ConversionResult, { status: "refused" }>;

const refusal = (
	absence: Refusal["absence"],
	codes: string[],
	reason: string,
): Refusal => ({
	status: "refused",
	absence,
	areaCount: codes.length,
	areaSample: codes.slice(0, 10),
	reason,
});

const weightOf = (target: TranslationStep["targets"][number]) =>
	typeof (target as { weight?: unknown }).weight === "number"
		? (target as { weight: number }).weight
		: undefined;

const populationWeighted = ({ artifact }: ConversionStep) =>
	"basis" in artifact.weighting && artifact.weighting.basis === "population";

/**
 * Carry source-exact observations through one or more crosswalk directions
 * onto the last step's areas. Each source keeps a distribution over the codes
 * it has reached; a split multiplies it by the step's published weights.
 *
 * Refuses rather than returning a partial answer. A code a step does not
 * carry would silently drop its value out of the total, and a split with no
 * published weight would need an assumption this API has no basis to make.
 */
export const convertThroughSteps = (
	path: readonly ConversionStep[],
	records: PopulationObservation[],
): ConversionResult => {
	let reached = records.map(
		(record) => new Map<string, number>([[record.areaCode, 1]]),
	);
	const splitSteps: ConversionStep[] = [];
	for (const [index, step] of path.entries()) {
		// Sets keep each source once, in partition order.
		const unmapped = new Set<string>();
		const unweighted = new Set<string>();
		let split = false;
		reached = reached.map((distribution, recordIndex) => {
			const source = records[recordIndex]!.areaCode;
			const next = new Map<string, number>();
			for (const [code, share] of distribution) {
				const translated = step.steps.get(code);
				if (!translated) {
					unmapped.add(source);
					continue;
				}
				const { targets } = translated;
				if (targets.length !== 1) {
					split = true;
					if (targets.some((target) => weightOf(target) === undefined)) {
						unweighted.add(source);
						continue;
					}
				}
				for (const target of targets)
					next.set(
						target.code,
						(next.get(target.code) ?? 0) + share * (weightOf(target) ?? 1),
					);
			}
			return next;
		});
		if (unmapped.size > 0) {
			const codes = [...unmapped];
			return refusal(
				"source-areas-not-mapped",
				codes,
				index === 0
					? `The crosswalk does not carry ${codes.length} of the source partition's area codes, starting with ${codes.slice(0, 3).join(", ")}. No partial conversion was applied.`
					: `Step ${index + 1} of the path, crosswalk ${step.artifact.id}, does not carry the areas reached from ${codes.length} of the source partition's area codes, starting with ${codes.slice(0, 3).join(", ")}. No partial conversion was applied.`,
			);
		}
		if (unweighted.size > 0)
			return refusal(
				"unweighted-split",
				[...unweighted],
				`${unweighted.size} source areas are split across several targets with no published weight${path.length > 1 ? ` at step ${index + 1} of the path, crosswalk ${step.artifact.id}` : ""}. Apportioning them would require an assumption the crosswalk does not support.`,
			);
		if (split) splitSteps.push(step);
	}

	const method: ConversionMethod =
		splitSteps.length === 0
			? "exact"
			: splitSteps.every(populationWeighted)
				? "population-weighted"
				: "area-weighted";
	const totals = new Map<string, { value: number; inputAreaCount: number }>();
	for (const [recordIndex, distribution] of reached.entries()) {
		const record = records[recordIndex]!;
		for (const [code, weight] of distribution) {
			const running = totals.get(code) ?? { value: 0, inputAreaCount: 0 };
			running.value += method === "exact" ? record.value : record.value * weight;
			running.inputAreaCount += 1;
			totals.set(code, running);
		}
	}

	return {
		status: "converted",
		method,
		inputRecordCount: records.length,
		records: [...totals.entries()]
			.map(([areaCode, { value, inputAreaCount }]) => ({
				areaCode,
				value,
				status: "derived" as const,
				inputAreaCount,
			}))
			.sort((left, right) => left.areaCode.localeCompare(right.areaCode)),
	};
};

/** Regroup source-exact observations onto one crosswalk's target areas. */
export const convertObservations = (
	artifact: CrosswalkArtifact,
	records: PopulationObservation[],
): ConversionResult =>
	convertThroughSteps(
		[
			{
				artifact,
				direction: "forward",
				steps: buildTranslationSteps(artifact, "forward"),
			},
		],
		records,
	);

/**
 * Which codes a route starts at end up in each code it finishes at, ignoring
 * weights: the parts a converted value for that code was built from.
 */
export const componentsThroughSteps = (
	path: readonly ConversionStep[],
): Map<string, Set<string>> => {
	const components = new Map<string, Set<string>>();
	const [first] = path;
	if (!first) return components;
	for (const source of first.steps.keys()) {
		let reached = new Set([source]);
		for (const step of path) {
			const next = new Set<string>();
			for (const code of reached)
				for (const target of step.steps.get(code)?.targets ?? [])
					next.add(target.code);
			reached = next;
		}
		for (const code of reached) {
			const held = components.get(code) ?? new Set<string>();
			held.add(source);
			components.set(code, held);
		}
	}
	return components;
};
