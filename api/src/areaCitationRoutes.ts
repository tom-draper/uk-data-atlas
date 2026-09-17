import type { BoundaryRegistry } from "./boundaryRegistry";
import type { CrosswalkInventory } from "./crosswalkInventory";
import type { DataCatalog } from "./dataCatalog";
import { attributionFor, attributionText } from "./attribution";
import { measureCoverage } from "./measureCoverage";
import { areaMeasureSources, areaNotFound } from "./areaResources";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** A citation for one area: the artifacts that serve it, pinned by hash, with their attribution and licences. */
export const handleAreaCitationRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 6 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		segments[5] !== "citation"
	)
		return undefined;
	const {
		boundaryRegistry: registry,
		areaInventory,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		validationReport,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
		measureCompatibilityInventory,
		geographyResolver,
	} = context;
	const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
		string,
		string,
		string,
	];
	if (!geographyResolver)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geography resolver before citing an area.",
		);
	const identity = { geography, boundaryRelease, code };
	const area = geographyResolver.area(identity);
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	if (!dataCatalog || !crosswalkInventory) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue and crosswalk inventory before citing an area.",
		);
	}
	const measureIds = [...new Set(parsedUrl.searchParams.getAll("measure"))];
	const crosswalkIds = [
		...new Set(parsedUrl.searchParams.getAll("crosswalk")),
	];
	const releaseIdentity = `${geography}/${boundaryRelease}`;
	// Resolved here only to refuse unknown resources; the bundle's own
	// attribution is narrowed below to what this area actually draws on.
	const requested = attributionFor(
		{
			datasets: [],
			measures: measureIds,
			boundaryReleases: [releaseIdentity],
			crosswalks: crosswalkIds,
		},
		dataCatalog,
		registry,
		crosswalkInventory,
	);
	if (requested.status === "unknown") {
		return problem(
			404,
			"Not Found",
			`No published resource matches ${requested.unknownResources.join(", ")}.`,
		);
	}

	// A crosswalk is cited for an area only when it maps that area; citing
	// one that does not would lend it evidence it never supplied.
	const relationships = geographyResolver.relationships({
		geography,
		boundaryRelease,
		code,
	});
	const unrelatedCrosswalks = crosswalkIds.filter(
		(id) =>
			!relationships.some(
				(relationship) => relationship.crosswalk.id === id,
			),
	);
	if (unrelatedCrosswalks.length > 0) {
		return problem(
			422,
			"Not Applicable To Area",
			`${unrelatedCrosswalks.map((id) => `crosswalk=${id}`).join(", ")} publishes no relationship for ${releaseIdentity}/${code}.`,
		);
	}

	// Likewise a measure is cited through the observation artifacts that
	// actually hold a value for this area, in partitions assessed against
	// this exact release.
	const measures = measureIds.map((measureId) => {
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === measureId,
		) as DataCatalog["measures"][number];
		const coverage = measureCompatibilityInventory
			? measureCoverage(
					dataCatalog,
					measureCompatibilityInventory,
					measureId,
				)
			: undefined;
		const sources = areaMeasureSources(
			measure,
			coverage,
			boundaryRelease,
			code,
			{
				populationObservations,
				populationLocalAuthorityObservations,
				measureObservations,
			},
		).flatMap((source) => {
			const periods = source.periods.flatMap((period) =>
				period.availability === "present"
					? [
							{
								period: period.period,
								artifact: period.artifact,
								contentHash: period.contentHash,
								status: period.status,
							},
						]
					: [],
			);
			return periods.length > 0
				? [
						{
							dataset: source.dataset,
							sourceGeography: source.sourceGeography,
							codeSetCompatibility: {
								status: source.codeSetCompatibility.status,
								eligibleForCodeJoin:
									source.codeSetCompatibility
										.eligibleForCodeJoin,
							},
							periods,
						},
					]
				: [];
		});
		return {
			id: measure.id,
			label: measure.label,
			href: `/v1/measures/${measure.id}`,
			sources,
		};
	});
	const uncitedMeasures = measures.filter(
		(measure) => measure.sources.length === 0,
	);
	if (uncitedMeasures.length > 0) {
		return problem(
			422,
			"Not Applicable To Area",
			`${uncitedMeasures.map((measure) => `measure=${measure.id}`).join(", ")} publishes no observation for ${releaseIdentity}/${code} in a source assessed against this boundary release.`,
		);
	}

	// A measure's other partitions hold no value for this area, so only the
	// datasets cited above are credited, with any derived measure's
	// denominator, which is as much a part of the value.
	const attribution = attributionFor(
		{
			datasets: [
				...measures.flatMap((measure) =>
					measure.sources.map((source) => source.dataset.id),
				),
				...measureIds.flatMap(
					(id) =>
						dataCatalog.measures.find(
							(candidate) => candidate.id === id,
						)?.derivedFrom?.datasetIds ?? [],
				),
			],
			measures: [],
			boundaryReleases: [releaseIdentity],
			crosswalks: crosswalkIds,
		},
		dataCatalog,
		registry,
		crosswalkInventory,
	);
	if (attribution.status === "unknown") {
		return problem(
			404,
			"Not Found",
			`No published resource matches ${attribution.unknownResources.join(", ")}.`,
		);
	}

	const release = registry.releases.find(
		(candidate) =>
			candidate.geography === geography &&
			candidate.id === boundaryRelease,
	) as BoundaryRegistry["releases"][number];
	const identityArtifact = areaInventory?.releases.find(
		(candidate) =>
			candidate.geography === geography &&
			candidate.id === boundaryRelease,
	);
	const geometryHref = `/v1/areas/${geography}/${boundaryRelease}/${code}/geometry`;
	const geometryHash = (inputHash?: string) =>
		inputHash
			? {
					status: "available" as const,
					scope: "source-file" as const,
					value: inputHash,
					note: "Hashes the whole source file this release's geometry is read from, not this area alone. Per-area geometry hashes are not compiled.",
				}
			: {
					status: "not-published" as const,
					note: "No hash of the geometry source is recorded for this release. The boundary release's metadataHash pins its metadata, which names the source file but does not hash its contents.",
				};
	const geometry = (() => {
		if (!geographyResolver.hasAreaGeometryCache())
			return {
				status: "not-published" as const,
				href: geometryHref,
				hash: geometryHash(),
			};
		try {
			const resolved = geographyResolver.areaGeometry(identity);
			return resolved
				? {
						status: "available" as const,
						href: geometryHref,
						provenance: resolved.geometrySource,
						hash: geometryHash(resolved.geometrySource.inputHash),
					}
				: {
						status: "not-found" as const,
						href: geometryHref,
						hash: geometryHash(),
					};
		} catch (error) {
			return {
				status: "unavailable" as const,
				href: geometryHref,
				reason:
					error instanceof Error
						? error.message
						: "Geometry could not be loaded.",
				hash: geometryHash(),
			};
		}
	})();

	const crosswalks = crosswalkIds.map((id) => {
		const entry = crosswalkInventory.crosswalks.find(
			(candidate) => candidate.id === id,
		) as CrosswalkInventory["crosswalks"][number];
		const artifact = crosswalkLookup?.get(id);
		return {
			id,
			method: entry.method,
			quality: entry.quality,
			from: entry.from,
			to: entry.to,
			contentHash: entry.contentHash,
			...(artifact ? { provenance: artifact.provenance } : {}),
			href: `/v1/crosswalks/${id}`,
		};
	});

	const validationIds = [
		"atlas",
		`boundary-releases/${releaseIdentity}`,
		...crosswalkIds.map((id) => `crosswalks/${id}`),
	];
	const validation = validationReport
		? {
				status: "available" as const,
				reportHash: validationReport.contentHash,
				resources: validationIds.map((id) => {
					const resource = validationReport.resources.find(
						(candidate) => candidate.id === id,
					);
					const href =
						id === "atlas"
							? "/v1/validation"
							: `/v1/validation/${id}`;
					return resource
						? { ...resource, href }
						: { id, status: "not-validated" as const };
				}),
			}
		: { status: "not-published" as const };

	return {
		status: 200,
		body: envelope(releaseId, {
			id: `${releaseIdentity}/${code}`,
			geography,
			boundaryRelease,
			...area,
			atlasRelease: atlasRelease
				? {
						id: releaseId,
						href: `/v1/atlas-releases/${releaseId}`,
					}
				: { id: releaseId, status: "not-published" as const },
			identity: identityArtifact
				? identityArtifact.status === "available"
					? {
							status: "available" as const,
							artifact: identityArtifact.artifact,
							contentHash: identityArtifact.contentHash,
							...(identityArtifact.derivedFrom
								? {
										derivedFrom:
											identityArtifact.derivedFrom,
									}
								: {}),
						}
					: {
							status: identityArtifact.status,
							reason: identityArtifact.reason,
						}
				: { status: "not-published" as const },
			boundary: {
				id: releaseIdentity,
				title: release.title,
				publisher: release.source.publisher,
				sourceUrl: release.source.url,
				...(release.source.retrievedAt
					? { retrievedAt: release.source.retrievedAt }
					: {}),
				licence: release.source.licence,
				metadataHash: release.metadataHash,
				href: `/v1/boundary-releases/${releaseIdentity}`,
			},
			geometry,
			measures,
			crosswalks,
			validation,
			resources: attribution.resources,
			licences: attribution.licences,
			text: attributionText(
				attribution.resources,
				attribution.licences,
				releaseId,
			),
			note: "Hashes pin the artifacts this Atlas release serves for the area. Licence names are reproduced as the publisher states them and are not interpreted here.",
		}),
	};
};
