import type { DataCatalog, Measure, MeasureSource } from "../dataCatalog";
import type {
	CompatibilityCandidate,
	CompatibilityStatus,
	MeasureCompatibilityInventory,
} from "../measureCompatibility";
import type { ProblemCode } from "../problemCodes";

/**
 * The first slice of the resolution layer described under
 * [Resolution contract](../../README.md): given what a caller asked for, say
 * what may be read and how, or refuse with the alternatives that would have
 * worked.
 *
 * It answers only; it never reads observations and never decides policy. A
 * route takes the plan and does the reading, so the rules for choosing a
 * source partition and accepting a geometry join live here once instead of in
 * every route that needs them.
 *
 * It also does nothing the caller did not ask for. It knows which releases
 * would match and which periods exist, and it puts them in the refusal rather
 * than quietly picking one.
 */

/** A join is only offered where every source code is present in the release. */
const JOINABLE: readonly CompatibilityStatus[] = [
	"exact-code-set",
	"code-set-compatible",
];

export type ObservationRequest = {
	measureId: string;
	period: string | null;
	geography?: string | null;
	boundaryYear?: string | null;
	/** A boundary release to draw the values on, joined by code, never converted. */
	release?: string | null;
};

export type ObservationPlan = {
	measure: Measure;
	source: MeasureSource;
	period: string;
	/** Present only where the caller asked to draw the values somewhere. */
	join?: {
		boundaryRelease: string;
		compatibility: CompatibilityStatus;
		/** Codes in the release the source has no value for. */
		candidateOnlyCodeCount: number;
	};
};

/**
 * Why the request cannot be served, and what could be. `alternatives` is not
 * decoration: a refusal that cannot tell a caller what to ask for instead
 * makes them guess, and guessing is what this API exists to remove.
 */
export type ObservationRefusal = {
	status: number;
	title: string;
	detail: string;
	code?: ProblemCode;
	alternatives?: {
		periods?: string[];
		partitions?: Array<{
			geography: string;
			boundaryYear: number;
			periods: string[];
		}>;
		releases?: string[];
	};
};

export type Resolution =
	| { kind: "plan"; plan: ObservationPlan }
	| { kind: "refusal"; refusal: ObservationRefusal };

const partitionsOf = (measure: Measure) =>
	measure.sources.map((source) => ({
		geography: source.sourceGeography.type,
		boundaryYear: source.sourceGeography.boundaryYear,
		periods: source.periods,
	}));

const periodsOf = (measure: Measure) => [
	...new Set(measure.sources.flatMap((source) => source.periods)),
];

export type ResolverInput = {
	dataCatalog?: DataCatalog;
	measureCompatibilityInventory?: MeasureCompatibilityInventory;
};

/**
 * Choose the source partition for a request, and say whether it may be drawn
 * on the release asked for.
 *
 * Where the caller names no geography, a measure with exactly one partition
 * for the period resolves to it; more than one is ambiguous and is refused
 * with the choices, because picking the first would make the answer depend on
 * catalogue order.
 */
export const resolveObservations = (
	{ dataCatalog, measureCompatibilityInventory }: ResolverInput,
	request: ObservationRequest,
): Resolution => {
	const refuse = (refusal: ObservationRefusal): Resolution => ({
		kind: "refusal",
		refusal,
	});
	if (!dataCatalog)
		return refuse({
			status: 503,
			title: "Catalogue Unavailable",
			detail: "Build the data catalogue before requesting observations.",
		});
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === request.measureId,
	);
	if (!measure)
		return refuse({
			status: 404,
			title: "Not Found",
			detail: `No measure is published as ${request.measureId}. Inspect /v1/measures for the ones that are.`,
		});

	if (!request.period)
		return refuse({
			status: 400,
			title: "Invalid Query",
			detail: `${measure.id} is published for named periods; ask for one of them with period=.`,
			alternatives: { periods: periodsOf(measure) },
		});

	const forPeriod = measure.sources.filter((source) =>
		source.periods.includes(request.period!),
	);
	if (forPeriod.length === 0)
		return refuse({
			status: 400,
			title: "Invalid Query",
			detail: `${measure.id} publishes no source for ${request.period}.`,
			alternatives: {
				periods: periodsOf(measure),
				partitions: partitionsOf(measure),
			},
		});

	const named = request.geography != null || request.boundaryYear != null;
	const matching = named
		? forPeriod.filter(
				(source) =>
					source.sourceGeography.type === request.geography &&
					String(source.sourceGeography.boundaryYear) ===
						request.boundaryYear,
			)
		: forPeriod;
	if (matching.length === 0)
		return refuse({
			status: 400,
			title: "Invalid Query",
			detail: `${measure.id} publishes no source on ${request.geography} ${request.boundaryYear} for ${request.period}.`,
			alternatives: { partitions: partitionsOf(measure) },
		});
	// Taking the first would make the answer depend on the order the catalogue
	// happens to list its sources in.
	if (matching.length > 1)
		return refuse({
			status: 400,
			title: "Ambiguous Source",
			detail: `${measure.id} publishes ${matching.length} sources for ${request.period}; name the geography and boundary year to choose one.`,
			alternatives: { partitions: partitionsOf(measure) },
		});
	const source = matching[0]!;

	const plan: ObservationPlan = { measure, source, period: request.period };
	if (request.release == null) return { kind: "plan", plan };

	const compatibility = measureCompatibilityInventory?.measures
		.find((entry) => entry.measureId === measure.id)
		?.sources.find(
			(entry) =>
				entry.datasetId === source.datasetId &&
				entry.sourceGeography.type === source.sourceGeography.type &&
				entry.sourceGeography.boundaryYear ===
					source.sourceGeography.boundaryYear,
		);
	const joinable = (candidate: CompatibilityCandidate) =>
		JOINABLE.includes(candidate.status) &&
		candidate.unmatchedSourceCodeCount === 0 &&
		candidate.matchedSourceShare === 1;
	const candidate = compatibility?.candidates.find(
		(entry) => entry.boundaryRelease === request.release,
	);
	if (!candidate || !joinable(candidate))
		return refuse({
			status: 422,
			title: "Operation Not Supported",
			detail: `${request.release} does not hold every source area code for this partition of ${measure.id}, so its values cannot be drawn on it. Inspect /v1/measures/${measure.id}/compatibility.`,
			code: "incompatible_geometry",
			alternatives: {
				releases: (compatibility?.candidates ?? [])
					.filter(joinable)
					.map((entry) => entry.boundaryRelease),
			},
		});
	return {
		kind: "plan",
		plan: {
			...plan,
			join: {
				boundaryRelease: candidate.boundaryRelease,
				compatibility: candidate.status,
				candidateOnlyCodeCount: candidate.candidateOnlyCodeCount,
			},
		},
	};
};
