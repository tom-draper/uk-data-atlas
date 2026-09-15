import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AreaInventory, AreaReleaseArtifact } from "./areaInventory";
import type { BoundaryRegistry } from "./boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import {
	countryForCode,
	type CategoricalObservation,
	type DataCatalog,
	type Measure,
	type MeasureSource,
	type PopulationObservation,
} from "./dataCatalog";
import type { BulkExport, ExportManifest } from "./exportManifest";
import type { GeographyInventory } from "./geographyInventory";
import type { GeometrySourceRegistry } from "./geometrySourceRegistry";
import { canServeAsWgs84, geometryProvenance } from "./reprojection";
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
	"measure-definition",
	"records-resolve",
	"countries-declared",
	"values-valid",
	"components-sum-to-total",
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
	/**
	 * A `measure-source` is one source partition of a measure, identified by
	 * the export that serves its observation artifact.
	 */
	kind:
		| "atlas"
		| "boundary-release"
		| "crosswalk"
		| "measure"
		| "measure-source";
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
			measures: number;
			measureSources: number;
		};
	};
	resources: ValidationResource[];
};

export type ValidationWaiver = {
	check: ValidationCheckId;
	reason: string;
	resources: string[];
};

/**
 * A measure whose value in every area is the sum of other measures in the same
 * source partitions, such as households counted by how many cars they have.
 */
export type MeasureTotal = {
	measureId: string;
	components: string[];
};

/**
 * An observation artifact as published. The ward population artifact predates
 * the per-period shape and carries one period at the top level.
 */
export type ObservationArtifact = {
	schemaVersion: 1;
	contentHash: string;
	measureId: string;
	sourceGeography: MeasureSource["sourceGeography"];
} & (
	| {
			periods: Array<{
				period: string;
				records: Array<PopulationObservation | CategoricalObservation>;
			}>;
	  }
	| { period: string; records: PopulationObservation[] }
);

export type ValidationInputs = {
	boundaryRegistry: BoundaryRegistry;
	areaInventory: AreaInventory;
	areaArtifacts: AreaReleaseArtifact[];
	geometrySources: GeometrySourceRegistry;
	crosswalkInventory: CrosswalkInventory;
	crosswalkArtifacts: CrosswalkArtifact[];
	relationshipCandidates: RelationshipCandidateInventory;
	geographyInventory: GeographyInventory;
	dataCatalog: DataCatalog;
	exportManifest: ExportManifest;
	/** Observation artifacts keyed by the id of the export that serves them. */
	observationArtifacts: Record<string, ObservationArtifact>;
	measureTotals: MeasureTotal[];
	measureTotalsHash: string;
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

export const readMeasureTotals = (path: string) => {
	const content = readFileSync(path, "utf8");
	const file = JSON.parse(content) as {
		schemaVersion?: unknown;
		totals?: unknown;
	};
	if (file.schemaVersion !== 1 || !Array.isArray(file.totals)) {
		throw new Error(`Invalid measure totals at ${path}`);
	}
	const isId = (value: unknown) =>
		typeof value === "string" && value.trim().length > 0;
	const measureTotals = file.totals.map((total: unknown) => {
		const { measureId, components } = (total ?? {}) as Record<
			string,
			unknown
		>;
		if (
			!isId(measureId) ||
			!Array.isArray(components) ||
			components.length < 2 ||
			!components.every(isId)
		) {
			throw new Error(`Invalid measure total at ${path}`);
		}
		return { measureId, components } as MeasureTotal;
	});
	return { measureTotals, measureTotalsHash: sha256(content) };
};

const atlasFindings = (inputs: ValidationInputs): Finding[] => {
	const registryHash = inputs.boundaryRegistry.contentHash;
	const staleInventories = [
		["area inventory", inputs.areaInventory.boundaryRegistryHash],
		["geography inventory", inputs.geographyInventory.boundaryRegistryHash],
	]
		.filter(([, hash]) => hash !== registryHash)
		.map(([name]) => name);
	const staleExports =
		inputs.exportManifest.dataCatalogHash !==
		inputs.dataCatalog.contentHash;
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
			staleInventories.length === 0 && !staleExports,
			[
				staleInventories.length > 0
					? `Built against an older boundary registry: ${staleInventories.join(", ")}.`
					: undefined,
				staleExports
					? "Built against an older data catalogue: export manifest."
					: undefined,
			]
				.filter((part) => part !== undefined)
				.join(" "),
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
	const corrections =
		geometry?.status === "available" && Array.isArray(geometry.corrections)
			? (geometry.corrections as unknown[]).map(String)
			: [];
	const geometryProblem =
		geometry?.status !== "available"
			? String(
					geometry?.reason ??
						"Absent from the geometry source registry.",
				)
			: !canServeAsWgs84(String(geometry.crs))
				? `Geometry is ${String(geometry.crs)}, and no transformation to WGS84 is available.`
				: corrections.length > 0 &&
					  String(geometry.crs) !== "EPSG:27700"
					? `Declares ${corrections.join(", ")}, a British National Grid correction, on ${String(geometry.crs)} geometry.`
					: undefined;
	const transformation =
		geometry?.status === "available"
			? geometryProvenance(String(geometry.crs)).transformation
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
				? {
						crs: String(geometry.crs),
						...(transformation
							? {
									transformation: transformation.name,
									transformationAccuracyM:
										transformation.accuracyM,
									...(corrections.length > 0
										? {
												corrections:
													corrections.join(", "),
											}
										: {}),
								}
							: {}),
					}
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

type Geography = { type: string; boundaryYear: number };

const sameGeography = (left: Geography, right: Geography) =>
	left.type === right.type && left.boundaryYear === right.boundaryYear;

const describeGeography = (geography: Geography) =>
	`${geography.type} ${geography.boundaryYear}`;

const exportFor = (
	inputs: ValidationInputs,
	measureId: string,
	source: { datasetId: string; sourceGeography: Geography },
) =>
	inputs.exportManifest.exports.find(
		(entry) =>
			entry.measureId === measureId &&
			entry.datasetId === source.datasetId &&
			sameGeography(entry.sourceGeography, source.sourceGeography),
	);

const periodsOf = (artifact: ObservationArtifact) =>
	"periods" in artifact
		? artifact.periods
		: [{ period: artifact.period, records: artifact.records }];

const areaCodeSets = new WeakMap<AreaReleaseArtifact, Set<string>>();
const areaCodesOf = (artifact: AreaReleaseArtifact) => {
	let codes = areaCodeSets.get(artifact);
	if (!codes) {
		codes = new Set(artifact.areas.map((area) => area.code));
		areaCodeSets.set(artifact, codes);
	}
	return codes;
};

// Counts are whole numbers, so any real difference is at least 1; this only
// absorbs floating-point error in a quantity.
const TOTAL_TOLERANCE = 1e-9;

const measureFindings = (
	inputs: ValidationInputs,
	measure: Measure,
): Finding[] => {
	const { aggregation } = measure;
	const datasetIds = new Set(
		inputs.dataCatalog.datasets.map((dataset) => dataset.id),
	);
	const problems: string[] = [];
	if (measure.availability.aggregation !== aggregation.available) {
		problems.push(
			`its availability and its ${aggregation.kind} aggregation disagree on whether it can be aggregated`,
		);
	}
	if (
		(measure.valueKind === "categorical") !==
		(aggregation.kind === "categorical")
	) {
		problems.push(
			`a ${measure.valueKind} value has ${aggregation.kind} aggregation`,
		);
	}
	if (measure.links.data !== `/v1/data/${measure.id}`) {
		problems.push(`its data link is ${measure.links.data}`);
	}
	const unknownDatasets = [
		...new Set([
			...measure.sources.map((source) => source.datasetId),
			...(measure.derivedFrom?.datasetIds ?? []),
		]),
	].filter((id) => !datasetIds.has(id));
	if (unknownDatasets.length > 0) {
		problems.push(
			`it names datasets the catalogue does not hold: ${listed(unknownDatasets)}`,
		);
	}
	const unexported = measure.sources.filter(
		(source) => !exportFor(inputs, measure.id, source),
	);
	if (unexported.length > 0) {
		problems.push(
			`no export serves its sources ${listed(
				unexported.map(
					(source) =>
						`${source.datasetId} on ${describeGeography(source.sourceGeography)}`,
				),
			)}`,
		);
	}
	if (aggregation.kind === "intensive" && aggregation.available) {
		const weight = inputs.dataCatalog.measures.find(
			(candidate) => candidate.id === aggregation.weight.measureId,
		);
		if (!weight) {
			problems.push(
				aggregation.weight.measureId
					? `its weight measure ${aggregation.weight.measureId} is not in the catalogue`
					: "its weighted mean is available without a weight measure",
			);
		} else {
			if (weight.aggregation.kind !== "extensive") {
				problems.push(`its weight ${weight.id} cannot be summed`);
			}
			const unweighted = measure.sources.filter(
				(source) =>
					!weight.sources.some(
						(candidate) =>
							sameGeography(
								candidate.sourceGeography,
								source.sourceGeography,
							) &&
							source.periods.every((period) =>
								candidate.periods.includes(period),
							),
					),
			);
			if (unweighted.length > 0) {
				problems.push(
					`${weight.id} has no partition to weight its sources on ${listed(
						unweighted.map((source) =>
							describeGeography(source.sourceGeography),
						),
					)}`,
				);
			}
		}
	}
	return [
		check(
			"measure-definition",
			problems.length === 0,
			`The definition is inconsistent: ${problems.join("; ")}.`,
			{ sourceCount: measure.sources.length },
		),
	];
};

const totalFinding = (
	inputs: ValidationInputs,
	source: MeasureSource,
	periods: ReturnType<typeof periodsOf>,
	total: MeasureTotal,
): Finding => {
	const problems: string[] = [];
	const components = total.components.flatMap((id) => {
		const entry = exportFor(inputs, id, source);
		const artifact = entry && inputs.observationArtifacts[entry.id];
		if (!artifact) {
			problems.push(
				`${id} has no partition from ${source.datasetId} on ${describeGeography(source.sourceGeography)}`,
			);
			return [];
		}
		const values = new Map(
			periodsOf(artifact).map((period) => [
				period.period,
				new Map(
					period.records.flatMap((record) =>
						"value" in record
							? [[record.areaCode, record.value] as const]
							: [],
					),
				),
			]),
		);
		return [{ id, values }];
	});
	const missing: string[] = [];
	const differences: string[] = [];
	let comparedCount = 0;
	let maxDifference = 0;
	if (problems.length === 0) {
		for (const period of periods) {
			const totalCodes = new Set(
				period.records.map((record) => record.areaCode),
			);
			for (const component of components) {
				const values = component.values.get(period.period);
				if (!values) {
					problems.push(
						`${component.id} has no ${period.period} period`,
					);
					continue;
				}
				const extra = [...values.keys()].filter(
					(code) => !totalCodes.has(code),
				);
				if (extra.length > 0) {
					problems.push(
						`${component.id} has ${period.period} values for areas with no total: ${listed(extra, 5)}`,
					);
				}
			}
			for (const record of period.records) {
				if (!("value" in record)) continue;
				const parts = components.map((component) =>
					component.values.get(period.period)?.get(record.areaCode),
				);
				if (parts.some((part) => part === undefined)) {
					missing.push(`${period.period} ${record.areaCode}`);
					continue;
				}
				comparedCount += 1;
				const sum = parts.reduce<number>(
					(runningTotal, part) => runningTotal + (part ?? 0),
					0,
				);
				const difference = Math.abs(sum - record.value);
				if (
					difference >
					TOTAL_TOLERANCE * Math.max(1, Math.abs(record.value))
				) {
					maxDifference = Math.max(maxDifference, difference);
					differences.push(
						`${period.period} ${record.areaCode} (${record.value} against ${Number(sum.toPrecision(12))})`,
					);
				}
			}
		}
	}
	const findings = [
		...problems,
		...(missing.length > 0
			? [`components have no value for ${listed(missing, 5)}`]
			: []),
		...(differences.length > 0
			? [
					`components differ from the total in ${differences.length} of ${comparedCount} area-periods: ${listed(differences, 5)}`,
				]
			: []),
	];
	return check(
		"components-sum-to-total",
		findings.length === 0,
		`The components do not add up to the total: ${findings.join("; ")}.`,
		{
			components: total.components.join(", "),
			comparedCount,
			mismatchCount: differences.length,
			maxDifference: Number(maxDifference.toPrecision(12)),
		},
	);
};

const measureSourceFindings = (
	inputs: ValidationInputs,
	entry: BulkExport,
): Finding[] => {
	const artifact = inputs.observationArtifacts[entry.id];
	const measure = inputs.dataCatalog.measures.find(
		(candidate) => candidate.id === entry.measureId,
	);
	const source = measure?.sources.find(
		(candidate) =>
			candidate.datasetId === entry.datasetId &&
			sameGeography(candidate.sourceGeography, entry.sourceGeography),
	);
	if (!artifact || !measure || !source) {
		return [
			check(
				"artifact-integrity",
				false,
				artifact
					? `No catalogue source matches ${entry.measureId} from ${entry.datasetId} on ${describeGeography(entry.sourceGeography)}.`
					: `No observation artifact was read for ${entry.artifact}.`,
			),
		];
	}
	const periods = periodsOf(artifact);
	const recordCount = periods.reduce(
		(count, period) => count + period.records.length,
		0,
	);

	const { contentHash, ...content } = artifact;
	const repeated = periods.flatMap((period) => {
		const seen = new Set<string>();
		return period.records.flatMap((record) => {
			const repeat = seen.has(record.areaCode);
			seen.add(record.areaCode);
			return repeat ? [`${period.period} ${record.areaCode}`] : [];
		});
	});
	// The catalogue counts the latest period, since coverage can vary by period.
	const latestCount = periods.at(-1)?.records.length ?? 0;
	const periodIds = periods.map((period) => period.period);
	const integrityProblems = [
		sha256(JSON.stringify(content)) === contentHash
			? undefined
			: "its content does not reproduce its hash",
		entry.contentHash === contentHash
			? undefined
			: "its hash differs from the export manifest",
		artifact.measureId === measure.id &&
		sameGeography(artifact.sourceGeography, source.sourceGeography)
			? undefined
			: `it holds ${artifact.measureId} on ${describeGeography(artifact.sourceGeography)}`,
		periodIds.join(",") === source.periods.join(",")
			? undefined
			: `its periods (${listed(periodIds)}) differ from the catalogue's (${listed(source.periods)})`,
		source.coverage.recordCount === latestCount
			? undefined
			: `the catalogue counts ${source.coverage.recordCount} records but its latest period has ${latestCount}`,
		repeated.length === 0
			? undefined
			: `area codes repeat within a period: ${listed(repeated)}`,
	].filter((problem) => problem !== undefined);

	const codes = [
		...new Set(
			periods.flatMap((period) =>
				period.records.map((record) => record.areaCode),
			),
		),
	].sort();
	const { type, boundaryYear } = source.sourceGeography;
	const resolution = inputs.boundaryRegistry.releases
		.filter(
			(release) =>
				release.geography === type &&
				release.temporalCoverage === String(boundaryYear),
		)
		.sort((left, right) => left.id.localeCompare(right.id))
		.flatMap((release) => {
			const areas = inputs.areaArtifacts.find(
				(candidate) =>
					candidate.geography === type &&
					candidate.boundaryRelease === release.id,
			);
			if (!areas) return [];
			const known = areaCodesOf(areas);
			return [
				{
					id: release.id,
					unresolved: codes.filter((code) => !known.has(code)),
				},
			];
		});
	const resolvedBy = resolution.find(
		(release) => release.unresolved.length === 0,
	);

	const unsupported: string[] = [];
	const countries = new Set<string>();
	for (const code of codes) {
		try {
			countries.add(countryForCode(code));
		} catch {
			unsupported.push(code);
		}
	}
	const foundCountries = [...countries].sort();
	const declaredCountries = [...source.coverage.countries].sort();

	const invalid: string[] = [];
	const categorical = measure.valueKind === "categorical";
	const percentage =
		measure.unit === "percent" || measure.unit.startsWith("% ");
	const statistic =
		measure.aggregation.kind === "non-aggregatable"
			? measure.aggregation.statistic
			: undefined;
	const categories = new Set<string>();
	let minimum = Number.POSITIVE_INFINITY;
	let maximum = Number.NEGATIVE_INFINITY;
	for (const period of periods) {
		for (const record of period.records) {
			const fail = (reason: string) =>
				invalid.push(`${period.period} ${record.areaCode} ${reason}`);
			if (record.status !== "observed" && record.status !== "derived") {
				fail(`has status ${String(record.status)}`);
			} else if (measure.derivedFrom && record.status !== "derived") {
				fail("is marked observed on a derived measure");
			}
			if (categorical) {
				if (
					!("category" in record) ||
					typeof record.category !== "string" ||
					record.category.trim().length === 0
				) {
					fail("has no category");
				} else {
					categories.add(record.category);
				}
				if ("value" in record)
					fail("carries a value on a categorical measure");
				continue;
			}
			if (
				!("value" in record) ||
				typeof record.value !== "number" ||
				!Number.isFinite(record.value)
			) {
				fail("has no finite value");
				continue;
			}
			const { value } = record;
			minimum = Math.min(minimum, value);
			maximum = Math.max(maximum, value);
			if (
				measure.valueKind === "count" &&
				!(Number.isInteger(value) && value >= 0)
			) {
				fail(
					`counts ${value}, which is not a whole number of at least 0`,
				);
			}
			if (
				measure.valueKind === "ratio" &&
				(value < 0 || (percentage && value > 100))
			) {
				fail(
					`is ${value}, outside ${percentage ? "0 to 100" : "0 or more"}`,
				);
			}
			if (measure.valueKind === "currency" && value < 0) {
				fail(`is a negative amount, ${value}`);
			}
			if (measure.valueKind === "ordinal") {
				const ceiling =
					statistic === "decile"
						? 10
						: statistic === "rank"
							? period.records.length
							: undefined;
				if (
					!Number.isInteger(value) ||
					value < 1 ||
					(ceiling !== undefined && value > ceiling)
				) {
					fail(
						ceiling === undefined
							? `is ${value}, not a whole number of at least 1`
							: `is ${value}, not a ${statistic} from 1 to ${ceiling}`,
					);
				}
			}
			const interval = record.confidenceInterval;
			if (interval) {
				if (!measure.uncertainty) {
					fail("carries an interval its measure does not declare");
				} else if (!(
					interval.lower <= value && value <= interval.upper
				)) {
					fail(
						`lies outside its interval, ${interval.lower} to ${interval.upper}`,
					);
				}
			}
		}
	}

	const findings = [
		check(
			"artifact-integrity",
			integrityProblems.length === 0,
			`The artifact is inconsistent: ${integrityProblems.join("; ")}.`,
			{ periodCount: periods.length, recordCount },
		),
		check(
			"records-resolve",
			resolvedBy !== undefined,
			resolution.length === 0
				? `No ${type} boundary release for ${boundaryYear} has compiled areas.`
				: `No compiled ${type} release for ${boundaryYear} holds every code: ${resolution
						.map(
							(release) =>
								`${release.id} lacks ${release.unresolved.length} (${listed(release.unresolved, 5)})`,
						)
						.join("; ")}.`,
			{
				areaCodeCount: codes.length,
				boundaryRelease: resolvedBy?.id ?? null,
				unresolvedCount: resolvedBy
					? 0
					: resolution.length > 0
						? Math.min(
								...resolution.map(
									(release) => release.unresolved.length,
								),
							)
						: codes.length,
			},
		),
		check(
			"countries-declared",
			unsupported.length === 0 &&
				foundCountries.join(",") === declaredCountries.join(","),
			unsupported.length > 0
				? `Codes belong to no UK nation: ${listed(unsupported)}.`
				: `Records cover ${foundCountries.join(", ")}, but the catalogue declares ${declaredCountries.join(", ")}.`,
			{ countries: foundCountries.join(", ") },
		),
		check(
			"values-valid",
			invalid.length === 0,
			`${invalid.length} records are invalid: ${listed(invalid, 5)}.`,
			categorical
				? { recordCount, categoryCount: categories.size }
				: {
						recordCount,
						minimum: recordCount > 0 ? minimum : null,
						maximum: recordCount > 0 ? maximum : null,
					},
		),
	];
	const total = inputs.measureTotals.find(
		(candidate) => candidate.measureId === measure.id,
	);
	if (total) findings.push(totalFinding(inputs, source, periods, total));
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
		...[...inputs.dataCatalog.measures]
			.sort((left, right) => left.id.localeCompare(right.id))
			.map((measure) => ({
				id: `measures/${measure.id}`,
				kind: "measure" as const,
				findings: measureFindings(inputs, measure),
			})),
		...[...inputs.exportManifest.exports]
			.sort((left, right) => left.id.localeCompare(right.id))
			.map((entry) => ({
				id: `exports/${entry.id}`,
				kind: "measure-source" as const,
				findings: measureSourceFindings(inputs, entry),
			})),
	];

	const waiverFor = new Map<string, ValidationWaiver>();
	const problems: string[] = [];
	const measures = new Map(
		inputs.dataCatalog.measures.map((measure) => [measure.id, measure]),
	);
	const totalled = new Set<string>();
	for (const total of inputs.measureTotals) {
		if (totalled.has(total.measureId)) {
			problems.push(`Duplicate measure total: ${total.measureId}.`);
		}
		totalled.add(total.measureId);
		for (const id of [total.measureId, ...total.components]) {
			const measure = measures.get(id);
			if (measure?.aggregation.kind !== "extensive") {
				problems.push(
					measure
						? `Measure total ${total.measureId} names ${id}, which cannot be summed.`
						: `Measure total ${total.measureId} names ${id}, which is not in the catalogue.`,
				);
			}
		}
	}
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
			dataCatalog: inputs.dataCatalog.contentHash,
			exportManifest: inputs.exportManifest.contentHash,
			measureTotals: inputs.measureTotalsHash,
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
						canServeAsWgs84(String(release.crs)),
				).length,
				withRelationships: geography.filter(
					(release) => release.relationships.status === "available",
				).length,
				crosswalks: inputs.crosswalkInventory.crosswalks.length,
				weightedCrosswalks: inputs.crosswalkInventory.crosswalks.filter(
					(crosswalk) => crosswalk.weighting.status === "provided",
				).length,
				measures: inputs.dataCatalog.measures.length,
				measureSources: inputs.exportManifest.exports.length,
			},
		},
		resources,
	};
	return {
		...withoutHash,
		contentHash: sha256(JSON.stringify(withoutHash)),
	};
};
