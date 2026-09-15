import { canServeAsWgs84 } from "../reprojection";
import type { ValidationResource, ValidationReport } from "../validationReport";
import { type Finding, sha256 } from "./findings";
import type { ValidationWaiver, ValidationInputs } from "./inputs";
import { atlasFindings } from "./atlasFindings";
import { boundaryReleaseFindings } from "./boundaryReleaseFindings";
import { crosswalkFindings } from "./crosswalkFindings";
import { measureFindings } from "./measureFindings";
import { measureSourceFindings } from "./measureSourceFindings";

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
