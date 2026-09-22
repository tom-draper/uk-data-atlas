import type { CrosswalkInventory } from "../crosswalkInventory";
import { type Finding, sha256, listed, check } from "./findings";
import type { ValidationInputs } from "./inputs";

// Weights are published to six decimal places, so a record of n targets can
// miss 1 by up to n * 5e-7 through rounding alone.
const WEIGHT_SUM_TOLERANCE = 1e-5;

export const crosswalkFindings = (
	inputs: ValidationInputs,
	summary: CrosswalkInventory["crosswalks"][number],
): Finding[] => {
	const artifact = inputs.crosswalkArtifacts.find(
		(candidate) => candidate.id === summary.id,
	);
	if (!artifact) {
		return [
			check(
				"artifact-integrity",
				false,
				`No artifact was read for ${summary.artifact}.`,
			),
		];
	}
	const { contentHash, ...content } = artifact;
	const sourceCodes = artifact.records.map((record) => record.source.code);
	const ordered = sourceCodes.every(
		(code, index) => index === 0 || sourceCodes[index - 1] < code,
	);
	const integrityProblems = [
		sha256(JSON.stringify(content)) === contentHash
			? undefined
			: "its content does not reproduce its hash",
		summary.contentHash === contentHash
			? undefined
			: "its hash differs from the crosswalk inventory",
		summary.recordCount === artifact.records.length
			? undefined
			: `the inventory lists ${summary.recordCount} records but it has ${artifact.records.length}`,
		ordered ? undefined : "its source codes are not unique and ordered",
	].filter((problem) => problem !== undefined);

	const endpointProblems = (["from", "to"] as const).flatMap((side) => {
		const validation = artifact.validation.endpoints[side];
		if (validation.status !== "verified")
			return [`${side}: ${validation.reason.replace(/\.$/, "")}`];
		const endpoint = artifact[side];
		const areas = inputs.areaArtifacts.find(
			(candidate) =>
				candidate.geography === endpoint.geography &&
				candidate.boundaryRelease === endpoint.boundaryRelease,
		);
		if (!areas) {
			return [
				`${side}: ${endpoint.geography}/${endpoint.boundaryRelease} is marked verified but has no compiled areas`,
			];
		}
		const known = new Set(areas.areas.map((area) => area.code));
		const codes =
			side === "from"
				? sourceCodes
				: artifact.records.flatMap((record) =>
						record.targets.map((target) => target.code),
					);
		const missing = [...new Set(codes)].filter((code) => !known.has(code));
		return missing.length === 0
			? []
			: [
					`${side}: ${missing.length} codes do not resolve (${listed(missing, 5)})`,
				];
	});

	const conflicts = artifact.validation.sourceNameConflicts;
	const findings = [
		check(
			"artifact-integrity",
			integrityProblems.length === 0,
			`The artifact is inconsistent: ${integrityProblems.join("; ")}.`,
			{ recordCount: artifact.records.length },
		),
		check(
			"endpoints-verified",
			endpointProblems.length === 0,
			`${endpointProblems.join("; ")}.`,
		),
		check(
			"source-names-consistent",
			conflicts.length === 0,
			`The input gives more than one name for ${listed(
				conflicts.map(
					(conflict) =>
						`${conflict.code} (${conflict.names.join(" / ")})`,
				),
			)}.`,
		),
	];

	const withoutTargets = artifact.records
		.filter((record) => record.targets.length === 0)
		.map((record) => record.source.code);
	findings.push(
		check(
			"targets-present",
			withoutTargets.length === 0,
			`Sources without a target: ${listed(withoutTargets)}.`,
		),
	);

	if (artifact.method === "clean-containment") {
		const multiParent = artifact.records
			.filter((record) => record.targets.length !== 1)
			.map((record) => record.source.code);
		findings.push(
			check(
				"single-parent",
				multiParent.length === 0,
				`Sources without exactly one parent: ${listed(multiParent)}.`,
			),
		);
	}

	if (
		artifact.method === "area-overlap" ||
		artifact.method === "population-overlap"
	) {
		const deviations = artifact.records.map((record) => ({
			code: record.source.code,
			deviation: Math.abs(
				record.targets.reduce(
					(total, target) => total + target.weight,
					0,
				) - 1,
			),
		}));
		const maxDeviation = Math.max(
			...deviations.map((entry) => entry.deviation),
		);
		findings.push(
			check(
				"weights-sum-to-one",
				maxDeviation <= WEIGHT_SUM_TOLERANCE,
				`Weights miss 1 by more than ${WEIGHT_SUM_TOLERANCE} for ${listed(
					deviations
						.filter(
							(entry) => entry.deviation > WEIGHT_SUM_TOLERANCE,
						)
						.map((entry) => entry.code),
				)}.`,
				{
					maxDeviation: Number(maxDeviation.toPrecision(3)),
					tolerance: WEIGHT_SUM_TOLERANCE,
				},
			),
		);
	}

	if (artifact.method === "population-overlap") {
		// Recompute each source's kept share from its published pairs, and
		// check every block's people are accounted for exactly once.
		const { population } = artifact.validation;
		const below = artifact.records
			.map(
				(record) =>
					[
						record.source.code,
						record.targets.reduce(
							(total, target) => total + target.sourceShare,
							0,
						),
					] as const,
			)
			.filter(
				([, coverage]) => coverage + 5e-6 < population.minimumCoverage,
			)
			.map(([code, coverage]) => `${code} (${coverage.toFixed(4)})`);
		const accounted =
			population.assignedPopulation +
			population.sliverPopulation +
			population.outsidePopulation +
			population.unmeasuredBlocks.reduce(
				(total, block) => total + block.population,
				0,
			);
		// Each of the four totals is rounded to a whole person.
		const balanced = Math.abs(accounted - population.blockPopulation) <= 2;
		findings.push(
			check(
				"population-coverage",
				below.length === 0 && balanced,
				[
					below.length > 0
						? `Sources below ${population.minimumCoverage} of their population: ${listed(below)}.`
						: undefined,
					balanced
						? undefined
						: `Blocks hold ${population.blockPopulation} people but ${accounted} are accounted for.`,
				]
					.filter(Boolean)
					.join(" "),
				{
					minimumCoverage: population.minimumCoverage,
					minimumSourceCoverage: population.minimumSourceCoverage,
					blockPopulation: population.blockPopulation,
					sliverPopulation: population.sliverPopulation,
					outsidePopulation: population.outsidePopulation,
					unmeasuredBlockCount: population.unmeasuredBlocks.length,
				},
			),
		);
	}

	if (artifact.method === "area-overlap") {

		// Recompute coverage from the published shares rather than trusting
		// the compiler's own minimums, and count targets that no source
		// reaches at all.
		const { overlap } = artifact.validation;
		const sourceCoverage = artifact.records.map(
			(record) =>
				[
					record.source.code,
					record.targets.reduce(
						(total, target) => total + target.sourceShare,
						0,
					),
				] as const,
		);
		const targetShares = new Map<string, number>();
		for (const record of artifact.records) {
			for (const target of record.targets) {
				targetShares.set(
					target.code,
					(targetShares.get(target.code) ?? 0) + target.targetShare,
				);
			}
		}
		const targetAreas = inputs.areaArtifacts.find(
			(candidate) =>
				candidate.geography === artifact.to.geography &&
				candidate.boundaryRelease === artifact.to.boundaryRelease,
		);
		const targetCoverage = (targetAreas?.areas ?? []).map(
			(area) => [area.code, targetShares.get(area.code) ?? 0] as const,
		);
		// Each share is rounded to six places; allow for that per target.
		const tolerance = 5e-6;
		const below = [...sourceCoverage, ...targetCoverage]
			.filter(
				([, coverage]) =>
					coverage + tolerance < overlap.minimumCoverage,
			)
			.map(([code, coverage]) => `${code} (${coverage.toFixed(4)})`);
		const minimum = (entries: ReadonlyArray<readonly [string, number]>) =>
			Number(
				Math.min(...entries.map(([, coverage]) => coverage)).toFixed(6),
			);
		findings.push(
			check(
				"area-coverage",
				below.length === 0 && targetCoverage.length > 0,
				`Areas below ${overlap.minimumCoverage} coverage: ${listed(below)}.`,
				{
					minimumCoverage: overlap.minimumCoverage,
					minimumSourceCoverage: minimum(sourceCoverage),
					minimumTargetCoverage:
						targetCoverage.length > 0
							? minimum(targetCoverage)
							: null,
				},
			),
		);

		const separated =
			(overlap.widestSliverWidthM === null ||
				overlap.widestSliverWidthM < overlap.sliverWidthM / 2) &&
			overlap.narrowestOverlapWidthM >= overlap.sliverWidthM * 2;
		findings.push(
			check(
				"sliver-separation",
				separated,
				`Pairs sit near the ${overlap.sliverWidthM} m sliver threshold.`,
				{
					sliverWidthM: overlap.sliverWidthM,
					widestSliverWidthM: overlap.widestSliverWidthM,
					narrowestOverlapWidthM: overlap.narrowestOverlapWidthM,
					sliverPairCount: overlap.sliverPairCount,
				},
			),
		);
	}

	if (artifact.method === "same-code-continuity") {
		// Recompute the identity claim from each published pair rather than
		// trusting the compiler's own count.
		const { continuity } = artifact.validation;
		const broken = artifact.records
			.filter(
				(record) =>
					record.targets.length !== 1 ||
					record.targets[0]!.code !== record.source.code ||
					record.targets[0]!.widestDifferenceM >=
						continuity.sliverWidthM / 2,
			)
			.map((record) => record.source.code);
		findings.push(
			check(
				"same-code-extent",
				broken.length === 0 &&
					continuity.continuousCount === artifact.records.length,
				`Pairs that are not one same-code target differing by less than ${continuity.sliverWidthM / 2} m: ${listed(broken)}.`,
				{
					sliverWidthM: continuity.sliverWidthM,
					sharedCodeCount: continuity.sharedCodeCount,
					changedExtentCount: continuity.changedExtent.length,
				},
			),
		);
	}
	return findings;
};
