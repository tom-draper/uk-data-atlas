import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AreaInventory, AreaReleaseArtifact } from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { GeographyInventory } from "./geographyInventory";
import type { GeometrySourceRegistry } from "./geometrySourceRegistry";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";

export const VALIDATION_CHECKS = [
	"registry-links",
	"release-coverage",
	"licence-recorded",
	"area-identities",
	"geometry-servable",
	"candidates-reviewed",
	"artifact-integrity",
	"endpoints-verified",
	"source-names-consistent",
	"targets-present",
	"single-parent",
	"weights-sum-to-one",
	"area-coverage",
	"sliver-separation",
] as const;

export type ValidationCheckId = (typeof VALIDATION_CHECKS)[number];

export type ValidationCheck = {
	id: ValidationCheckId;
	status: "passed" | "waived";
	/** What the check found; present on every waived check. */
	detail?: string;
	measured?: Record<string, number | string | null>;
	waiver?: { reason: string };
};

export type ValidationResource = {
	id: string;
	kind: "atlas" | "boundary-release" | "crosswalk";
	status: "passed" | "waived";
	checks: ValidationCheck[];
};

export type ValidationReport = {
	schemaVersion: 1;
	contentHash: string;
	inputs: Record<string, string>;
	summary: {
		resourceCount: number;
		checkCount: number;
		passedCount: number;
		waivedCount: number;
		coverage: {
			boundaryReleases: number;
			areaIdentities: number;
			servableGeometry: number;
			withRelationships: number;
			crosswalks: number;
			weightedCrosswalks: number;
		};
	};
	resources: ValidationResource[];
};

export type ValidationWaiver = {
	check: ValidationCheckId;
	reason: string;
	resources: string[];
};

export type ValidationInputs = {
	boundaryRegistry: BoundaryRegistry;
	areaInventory: AreaInventory;
	areaArtifacts: AreaReleaseArtifact[];
	geometrySources: GeometrySourceRegistry;
	crosswalkInventory: CrosswalkInventory;
	crosswalkArtifacts: CrosswalkArtifact[];
	relationshipCandidates: RelationshipCandidateInventory;
	geographyInventory: GeographyInventory;
	waivers: ValidationWaiver[];
	waiversHash: string;
};

type Finding = {
	id: ValidationCheckId;
	passed: boolean;
	detail?: string;
	measured?: Record<string, number | string | null>;
};

// Weights are published to six decimal places, so a record of n targets can
// miss 1 by up to n * 5e-7 through rounding alone.
const WEIGHT_SUM_TOLERANCE = 1e-5;

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const isWgs84 = (crs: string) =>
	crs === "EPSG:4326" || crs === "CRS84" || crs.endsWith(":CRS84");

const listed = (values: string[], limit = 10) =>
	values.length > limit
		? `${values.slice(0, limit).join(", ")} and ${values.length - limit} more`
		: values.join(", ");

const check = (
	id: ValidationCheckId,
	passed: boolean,
	detail?: string,
	measured?: Finding["measured"],
): Finding => ({
	id,
	passed,
	...(passed || detail === undefined ? {} : { detail }),
	...(measured ? { measured } : {}),
});

export const readValidationWaivers = (path: string) => {
	const content = readFileSync(path, "utf8");
	const file = JSON.parse(content) as {
		schemaVersion?: unknown;
		waivers?: unknown;
	};
	if (file.schemaVersion !== 1 || !Array.isArray(file.waivers)) {
		throw new Error(`Invalid validation waivers at ${path}`);
	}
	const waivers = file.waivers.map((waiver: unknown) => {
		const { check, reason, resources } = (waiver ?? {}) as Record<
			string,
			unknown
		>;
		if (
			!VALIDATION_CHECKS.includes(check as ValidationCheckId) ||
			typeof reason !== "string" ||
			reason.trim().length === 0 ||
			!Array.isArray(resources) ||
			resources.length === 0 ||
			!resources.every((resource) => typeof resource === "string")
		) {
			throw new Error(`Invalid validation waiver at ${path}`);
		}
		return { check, reason, resources } as ValidationWaiver;
	});
	return { waivers, waiversHash: sha256(content) };
};

const atlasFindings = (inputs: ValidationInputs): Finding[] => {
	const registryHash = inputs.boundaryRegistry.contentHash;
	const staleInventories = [
		["area inventory", inputs.areaInventory.boundaryRegistryHash],
		["geography inventory", inputs.geographyInventory.boundaryRegistryHash],
	]
		.filter(([, hash]) => hash !== registryHash)
		.map(([name]) => name);
	const releaseIds = new Set(
		inputs.boundaryRegistry.releases.map(
			(release) => `${release.geography}/${release.id}`,
		),
	);
	const inventories: Array<[string, string[]]> = [
		[
			"area inventory",
			inputs.areaInventory.releases.map(
				(release) => `${release.geography}/${release.id}`,
			),
		],
		[
			"geometry source registry",
			inputs.geometrySources.releases.map((release) =>
				String(release.id),
			),
		],
		[
			"geography inventory",
			inputs.geographyInventory.releases.map(
				(release) => `${release.geography}/${release.id}`,
			),
		],
	];
	const mismatches = inventories.flatMap(([name, ids]) => {
		const present = new Set(ids);
		const missing = [...releaseIds].filter((id) => !present.has(id));
		const extra = ids.filter((id) => !releaseIds.has(id));
		return missing.length + extra.length === 0
			? []
			: [
					`${name} is missing ${missing.length} and adds ${extra.length} releases (${listed([...missing, ...extra], 5)})`,
				];
	});
	return [
		check(
			"registry-links",
			staleInventories.length === 0,
			`Built against an older boundary registry: ${staleInventories.join(", ")}.`,
		),
		check(
			"release-coverage",
			mismatches.length === 0,
			`${mismatches.join("; ")}.`,
			{ boundaryReleaseCount: releaseIds.size },
		),
	];
};

const boundaryReleaseFindings = (
	inputs: ValidationInputs,
	release: BoundaryRegistry["releases"][number],
): Finding[] => {
	const identity = `${release.geography}/${release.id}`;
	const { source } = release;
	const missingProvenance = [
		["publisher", source.publisher],
		["source URL", source.url],
		["licence name", source.licence?.name],
		["licence URL", source.licence?.url],
	]
		.filter(([, value]) => typeof value !== "string" || value.length === 0)
		.map(([name]) => name);

	const areaRelease = inputs.areaInventory.releases.find(
		(candidate) =>
			candidate.geography === release.geography &&
			candidate.id === release.id,
	);
	const artifact = inputs.areaArtifacts.find(
		(candidate) =>
			candidate.geography === release.geography &&
			candidate.boundaryRelease === release.id,
	);
	let identityProblem: string | undefined;
	if (!areaRelease || areaRelease.status !== "available") {
		identityProblem = areaRelease
			? `Not compiled: ${areaRelease.reason}`
			: "Absent from the area inventory.";
	} else if (!artifact || artifact.contentHash !== areaRelease.contentHash) {
		identityProblem =
			"The area artifact does not match the inventory hash.";
	} else {
		const seen = new Set<string>();
		const duplicates = new Set<string>();
		const unnamed: string[] = [];
		for (const area of artifact.areas) {
			if (seen.has(area.code)) duplicates.add(area.code);
			seen.add(area.code);
			if (area.name.trim().length === 0) unnamed.push(area.code);
		}
		if (artifact.areas.length === 0) identityProblem = "No areas compiled.";
		else if (duplicates.size > 0)
			identityProblem = `Duplicate codes: ${listed([...duplicates])}.`;
		else if (unnamed.length > 0)
			identityProblem = `Areas without names: ${listed(unnamed)}.`;
	}

	const geometry = inputs.geometrySources.releases.find(
		(candidate) => candidate.id === identity,
	);
	const geometryProblem =
		geometry?.status !== "available"
			? String(
					geometry?.reason ??
						"Absent from the geometry source registry.",
				)
			: !isWgs84(String(geometry.crs))
				? `Geometry is ${String(geometry.crs)}, and only WGS84 geometry is served.`
				: undefined;

	const unreviewed = inputs.relationshipCandidates.candidates.filter(
		(candidate) =>
			candidate.from.geography === release.geography &&
			candidate.from.boundaryRelease === release.id &&
			(candidate.status === "needs-review" ||
				(candidate.status === "eligible" &&
					!candidate.publishedCrosswalkId)),
	);

	return [
		check(
			"licence-recorded",
			missingProvenance.length === 0,
			`Missing ${missingProvenance.join(", ")}.`,
		),
		check(
			"area-identities",
			identityProblem === undefined,
			identityProblem,
			artifact ? { areaCount: artifact.areas.length } : undefined,
		),
		check(
			"geometry-servable",
			geometryProblem === undefined,
			geometryProblem,
			geometry?.status === "available"
				? { crs: String(geometry.crs) }
				: undefined,
		),
		check(
			"candidates-reviewed",
			unreviewed.length === 0,
			`Relationship candidates awaiting a decision: ${listed(
				unreviewed.map(
					(candidate) => `${candidate.id} (${candidate.status})`,
				),
			)}.`,
		),
	];
};

const crosswalkFindings = (
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

	if (artifact.method === "area-overlap") {
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
	return findings;
};

export const compileValidationReport = (
	inputs: ValidationInputs,
): ValidationReport => {
	const assessed: Array<{
		id: string;
		kind: ValidationResource["kind"];
		findings: Finding[];
	}> = [
		{ id: "atlas", kind: "atlas", findings: atlasFindings(inputs) },
		...[...inputs.boundaryRegistry.releases]
			.sort(
				(left, right) =>
					left.geography.localeCompare(right.geography) ||
					left.id.localeCompare(right.id),
			)
			.map((release) => ({
				id: `boundary-releases/${release.geography}/${release.id}`,
				kind: "boundary-release" as const,
				findings: boundaryReleaseFindings(inputs, release),
			})),
		...[...inputs.crosswalkInventory.crosswalks]
			.sort((left, right) => left.id.localeCompare(right.id))
			.map((crosswalk) => ({
				id: `crosswalks/${crosswalk.id}`,
				kind: "crosswalk" as const,
				findings: crosswalkFindings(inputs, crosswalk),
			})),
	];

	const waiverFor = new Map<string, ValidationWaiver>();
	const problems: string[] = [];
	for (const waiver of inputs.waivers) {
		for (const resource of waiver.resources) {
			const key = `${waiver.check} ${resource}`;
			if (waiverFor.has(key)) problems.push(`Duplicate waiver: ${key}.`);
			waiverFor.set(key, waiver);
		}
	}
	const usedWaivers = new Set<string>();
	const resources = assessed.map(
		({ id, kind, findings }): ValidationResource => {
			const checks = findings.map(
				({ id: checkId, passed, detail, measured }) => {
					const key = `${checkId} ${id}`;
					const waiver = waiverFor.get(key);
					if (passed) {
						return {
							id: checkId,
							status: "passed" as const,
							...(measured ? { measured } : {}),
						};
					}
					// An unwaived failure is reported below and stops the build, so
					// only waived failures are ever published.
					if (!waiver)
						problems.push(`${id} fails ${checkId}: ${detail}`);
					usedWaivers.add(key);
					return {
						id: checkId,
						status: "waived" as const,
						detail,
						...(measured ? { measured } : {}),
						waiver: { reason: waiver?.reason ?? "" },
					};
				},
			);
			return {
				id,
				kind,
				status: checks.some((entry) => entry.status === "waived")
					? "waived"
					: "passed",
				checks,
			};
		},
	);
	for (const key of waiverFor.keys()) {
		if (!usedWaivers.has(key)) {
			problems.push(
				`Unused waiver, the check now passes or the resource is gone: ${key}.`,
			);
		}
	}
	if (problems.length > 0) {
		throw new Error(
			`Validation failed. Fix each problem, or record a waiver with its reason in config/validation-waivers.json:\n- ${problems.join("\n- ")}`,
		);
	}

	const checks = resources.flatMap((resource) => resource.checks);
	const geography = inputs.geographyInventory.releases;
	const withoutHash = {
		schemaVersion: 1 as const,
		inputs: {
			boundaryRegistry: inputs.boundaryRegistry.contentHash,
			areaInventory: inputs.areaInventory.contentHash,
			geometrySources: inputs.geometrySources.contentHash,
			crosswalkInventory: inputs.crosswalkInventory.contentHash,
			relationshipCandidates: inputs.relationshipCandidates.contentHash,
			geographyInventory: inputs.geographyInventory.contentHash,
			waivers: inputs.waiversHash,
		},
		summary: {
			resourceCount: resources.length,
			checkCount: checks.length,
			passedCount: checks.filter((entry) => entry.status === "passed")
				.length,
			waivedCount: checks.filter((entry) => entry.status === "waived")
				.length,
			coverage: {
				boundaryReleases: inputs.boundaryRegistry.releases.length,
				areaIdentities: inputs.areaInventory.releases.filter(
					(release) => release.status === "available",
				).length,
				servableGeometry: inputs.geometrySources.releases.filter(
					(release) =>
						release.status === "available" &&
						isWgs84(String(release.crs)),
				).length,
				withRelationships: geography.filter(
					(release) => release.relationships.status === "available",
				).length,
				crosswalks: inputs.crosswalkInventory.crosswalks.length,
				weightedCrosswalks: inputs.crosswalkInventory.crosswalks.filter(
					(crosswalk) => crosswalk.weighting.status === "provided",
				).length,
			},
		},
		resources,
	};
	return {
		...withoutHash,
		contentHash: sha256(JSON.stringify(withoutHash)),
	};
};
