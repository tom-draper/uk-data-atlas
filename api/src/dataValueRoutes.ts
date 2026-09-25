import { valueForPlace } from "./placeValue";
import { describeAttempt, describeCandidate } from "./placeResponses";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** A measure's value for one named place, reporting each candidate meaning that was tried. */
export const handleDataValueRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
	dispatch,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "data" ||
		segments[3] !== "value"
	)
		return undefined;
	const { dataCatalog } = context;
	if (!dataCatalog) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue before answering for a place.",
		);
	}
	const measureId = segments[2] as string;
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === measureId,
	);
	if (!measure) {
		return problem(
			404,
			"Not Found",
			`No published measure ${measureId}. GET /v1/measures lists them.`,
		);
	}
	const place = parsedUrl.searchParams.get("place")?.trim();
	if (!place) {
		return problem(
			400,
			"Invalid Query",
			"place is required: a place name such as North West, an area code, or a place reference from /v1/places.",
		);
	}
	const unavailable =
		context.geographyResolver.requires("areas") ??
		context.geographyResolver.requires("places");
	if (unavailable) return unavailable;
	const period = parsedUrl.searchParams.get("period")?.trim() || undefined;
	const candidates = context.geographyResolver.places(place, 12);
	// Each candidate goes to the route that already serves its kind of
	// place, so the value and every refusal are exactly what that route
	// gives when called directly.
	const outcome = valueForPlace(measure, candidates, period, dispatch);
	if (outcome.outcome === "unmatched") {
		return problem(
			404,
			"Unknown Place",
			`No place is called or coded "${place}". GET /v1/places?q= searches names, and matches the start of a name as well as the whole.`,
		);
	}
	if (outcome.outcome === "unserved") {
		return problem(
			422,
			"Place Not Served",
			`"${place}" matched ${outcome.attempts.length} place${outcome.attempts.length === 1 ? "" : "s"}, and ${measureId} answers none of them. Each candidate below says why.`,
			{ candidates: outcome.attempts.map(describeAttempt) },
		);
	}
	if (outcome.outcome === "ambiguous") {
		return problem(
			409,
			"Ambiguous Place",
			`"${place}" names ${outcome.choices.length} places that ${measureId} answers differently. Each choice carries its answer; ask again with the place reference of the one meant.`,
			{
				code: "ambiguous_place",
				choices: outcome.choices.map((choice) => ({
					...describeAttempt(choice),
					ask: `/v1/data/${measureId}/value?place=${encodeURIComponent(choice.candidate.place)}${period ? `&period=${encodeURIComponent(period)}` : ""}`,
				})),
			},
		);
	}
	const { chosen, attempts } = outcome;
	return {
		status: 200,
		body: envelope(releaseId, {
			measure: {
				id: measure.id,
				label: measure.label,
				valueKind: measure.valueKind,
				unit: measure.unit,
			},
			question: { place, period: period ?? null },
			answer: { ...chosen.answer, unit: measure.unit },
			place: describeCandidate(chosen.candidate),
			method: chosen.method,
			// The call that gives this answer directly, with its full
			// provenance, for a caller that wants to cite or repeat it.
			via: chosen.via,
			otherMatches: attempts
				.filter((attempt) => attempt !== chosen)
				.map(describeAttempt),
			note: [
				chosen.answer.periodDefaulted
					? `No period was given, so the latest published, ${chosen.answer.period}, was used.`
					: undefined,
				chosen.method === "aggregate"
					? "Summed from the local authorities the place is made of; the aggregate route's response, at via, lists any member codes of another vintage it passed over."
					: "The value as published for this area.",
				attempts.length > 1
					? "The name matched other places, listed in otherMatches; any that cover the same ground as this one gave the same answer."
					: undefined,
			]
				.filter(Boolean)
				.join(" "),
		}),
	};
};
