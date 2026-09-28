import type { RelationshipPurpose } from "./relationshipPaths";
import type { DataCatalog } from "./dataCatalog";
import {
	publishedSourcePartitionOf,
	publishedSourcePartitionsFor,
	type MeasureCompatibilityInventory,
} from "./measureCompatibility";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

const RELATIONSHIP_PURPOSES: RelationshipPurpose[] = [
	"identity",
	"membership",
	"apportion",
];

const measureReadiness = (
	catalog: DataCatalog | undefined,
	compatibilityInventory: MeasureCompatibilityInventory | undefined,
	measureId: string,
	purpose: RelationshipPurpose,
	from: { geography: string; boundaryRelease: string },
) => {
	if (!catalog)
		return {
			status: "not-built" as const,
			reason: "Build the data catalogue before assessing a measure's conversion semantics.",
		};
	const measure = catalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	if (!measure)
		return {
			status: "unsupported" as const,
			reason: `No published measure matches ${measureId}.`,
		};
	if (!compatibilityInventory)
		return {
			measure: { id: measure.id, unit: measure.unit },
			status: "not-built" as const,
			reason: "Build measure compatibility before assessing whether the source partition's codes fit the requested release.",
		};
	const compatibility = compatibilityInventory.measures.find(
		(candidate) => candidate.measureId === measure.id,
	);
	const sourceCompatibility =
		compatibility?.sources
			.filter((source) => source.sourceGeography.type === from.geography)
			.map((source) => ({
				datasetId: source.datasetId,
				boundaryYear: source.sourceGeography.boundaryYear,
				periods: source.periods,
				candidates: source.candidates.filter(
					(candidate) =>
						candidate.boundaryRelease === from.boundaryRelease,
				),
			})) ?? [];
	const matchingSources =
		compatibility?.sources.filter(
			(source) =>
				source.sourceGeography.type === from.geography &&
				source.candidates.some(
					(candidate) =>
						candidate.boundaryRelease === from.boundaryRelease &&
						(candidate.status === "exact-code-set" ||
							candidate.status === "code-set-compatible"),
				),
		) ?? [];
	if (matchingSources.length === 0) {
		const statuses = sourceCompatibility.flatMap((source) =>
			source.candidates.map((candidate) => candidate.status),
		);
		return {
			measure: { id: measure.id, unit: measure.unit },
			status: "unsupported" as const,
			reason:
				statuses.length > 0
					? `${measure.id} has ${[...new Set(statuses)].join(" and ")} source-code compatibility with ${from.geography}/${from.boundaryRelease}; a complete code set is required.`
					: `${measure.id} has no published source partition whose codes are compatible with ${from.geography}/${from.boundaryRelease}.`,
			publishedSourcePartitions: publishedSourcePartitionsFor(
				measure,
				from.geography,
			),
			sourceCompatibility,
		};
	}
	const sourcePartitions = matchingSources.map((source) => ({
		...publishedSourcePartitionOf(measure, source)!,
		compatibility: source.candidates.find(
			(candidate) => candidate.boundaryRelease === from.boundaryRelease,
		),
	}));
	if (purpose === "identity")
		return {
			measure: { id: measure.id, unit: measure.unit },
			sourcePartitions,
			status: "available" as const,
			operation: "identity-join",
			reason: "An identity path can align this measure's area identifiers without changing values.",
		};
	if (purpose === "membership" && measure.aggregation.kind === "intensive")
		return measure.aggregation.available
			? {
					measure: { id: measure.id, unit: measure.unit },
					sourcePartitions,
					status: "requires-conversion" as const,
					operation: "weighted-mean",
					weight: measure.aggregation.weight,
					reason: "This intensive measure requires the declared denominator; it must not be summed across members.",
				}
			: {
					measure: { id: measure.id, unit: measure.unit },
					sourcePartitions,
					status: "unsupported" as const,
					reason: "This intensive measure requires a weighted mean, but no published aggregation operation is available.",
				};
	if (
		measure.aggregation.kind === "extensive" &&
		measure.aggregation.available
	)
		return {
			measure: { id: measure.id, unit: measure.unit },
			sourcePartitions,
			status: "available" as const,
			operation:
				purpose === "membership"
					? "containment-aggregation"
					: "weighted-allocation",
			reason: "This extensive measure may be summed or allocated using the declared relationship operation.",
		};
	return {
		measure: { id: measure.id, unit: measure.unit },
		sourcePartitions,
		status: "unsupported" as const,
		reason: `This measure is ${measure.aggregation.kind}; ${purpose === "membership" ? "containment aggregation" : "weighted allocation"} is not published as a safe operation.`,
	};
};

/**
 * Answers a conversion question as an operational capability: paths, their
 * measurable coverage, and the artifacts still required to use them.
 */
export const handleRelationshipCapabilityRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "relationship-capabilities"
	)
		return undefined;
	const from = {
		geography: parsedUrl.searchParams.get("sourceGeography"),
		boundaryRelease: parsedUrl.searchParams.get("sourceRelease"),
	};
	const to = {
		geography: parsedUrl.searchParams.get("targetGeography"),
		boundaryRelease: parsedUrl.searchParams.get("targetRelease"),
	};
	const purposeParameter = parsedUrl.searchParams.get("purpose");
	const measureId = parsedUrl.searchParams.get("measure");
	if (
		!from.geography ||
		!from.boundaryRelease ||
		(to.geography === null) !== (to.boundaryRelease === null) ||
		((to.geography !== null || to.boundaryRelease !== null) &&
			!RELATIONSHIP_PURPOSES.includes(
				purposeParameter as RelationshipPurpose,
			)) ||
		(to.geography === null &&
			to.boundaryRelease === null &&
			purposeParameter !== null) ||
		((to.geography === null || to.boundaryRelease === null) &&
			measureId !== null)
	) {
		return problem(
			400,
			"Invalid Query",
			"sourceGeography and sourceRelease are required. To diagnose one conversion, provide targetGeography, targetRelease and purpose (identity, membership or apportion) together.",
		);
	}
	const geographyResolver = context.geographyResolver;
	if (to.geography === null || to.boundaryRelease === null) {
		const source = from as { geography: string; boundaryRelease: string };
		if (
			!geographyResolver.hasAreaRelease(
				source.geography,
				source.boundaryRelease,
			)
		) {
			return {
				status: 200,
				body: envelope(releaseId, {
					from,
					status: "not-built" as const,
					reason: `No compiled area identity artifact is available for ${source.geography}/${source.boundaryRelease}.`,
					capabilities: [],
					missingPrerequisites: [
						{
							id: "source-areas",
							status: "not-built" as const,
							reason: `No compiled area identity artifact is available for ${source.geography}/${source.boundaryRelease}.`,
						},
					],
				}),
			};
		}
		const capabilities =
			geographyResolver.relationshipCapabilitiesFrom(source);
		return {
			status: 200,
			body: envelope(releaseId, {
				from,
				status:
					capabilities.length > 0
						? ("available" as const)
						: ("unsupported" as const),
				...(capabilities.length > 0
					? {}
					: {
							reason: `No declared conversion paths start at ${from.geography}/${from.boundaryRelease}.`,
						}),
				capabilities,
			}),
		};
	}
	const purpose = purposeParameter as RelationshipPurpose;
	const capability = geographyResolver.relationshipCapability(
		from as { geography: string; boundaryRelease: string },
		to as { geography: string; boundaryRelease: string },
		purpose,
	);
	return {
		status: 200,
		body: envelope(releaseId, {
			from,
			to,
			purpose,
			status: capability.status,
			...(capability.status === "available"
				? {}
				: {
						reason:
							capability.missingPrerequisites[0]?.reason ??
							"A published conversion path has incomplete coverage.",
					}),
			paths: capability.paths,
			missingPrerequisites: capability.missingPrerequisites,
			...(measureId
				? {
						measureReadiness: measureReadiness(
							context.dataCatalog,
							context.measureCompatibilityInventory,
							measureId,
							purpose,
							from as {
								geography: string;
								boundaryRelease: string;
							},
						),
					}
				: {}),
		}),
	};
};
