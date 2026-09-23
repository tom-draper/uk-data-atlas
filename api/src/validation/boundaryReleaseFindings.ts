import type { BoundaryRegistry } from "../boundaryRegistry";
import { canServeAsWgs84, geometryProvenance } from "../reprojection";
import { type Finding, listed, check } from "./findings";
import type { ValidationInputs } from "./inputs";
import { releaseKey } from "../geographyKeys";

export const boundaryReleaseFindings = (
	inputs: ValidationInputs,
	release: BoundaryRegistry["releases"][number],
): Finding[] => {
	const identity = releaseKey(release.geography, release.id);
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
