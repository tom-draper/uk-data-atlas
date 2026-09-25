import type { Measure } from "./dataCatalog";
import { CONTAINMENT_NOTE, countryOfCode } from "./pointLookup";
import {
	findPostcode,
	POSTCODE_NOTE,
	UNDECLARED_POSTCODE_ACCURACY,
} from "./postcodeRoutes";
import { postcodeLookupPoint } from "./postcodes";
import {
	attemptSource,
	postcodeSources,
	sourceReleases,
	type SourceAttempt,
} from "./postcodeValue";
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
	const postcode = parsedUrl.searchParams.get("postcode")?.trim();
	if (place && postcode) {
		return problem(
			400,
			"Invalid Query",
			"Give place or postcode, not both.",
		);
	}
	if (postcode)
		return postcodeValue(
			{ context, releaseId, parsedUrl, segments, dispatch },
			measure,
			postcode,
		);
	if (!place) {
		return problem(
			400,
			"Invalid Query",
			"place or postcode is required: a place name such as North West, an area code, a place reference from /v1/places, or a unit postcode such as SW1A 1AA.",
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

/**
 * A measure's value for the area its data was published for that contains a
 * postcode. One geography is read per request: the one asked for, or else the
 * finest the measure is published on, since that is the most local answer.
 */
const postcodeValue = (
	{ context, releaseId, parsedUrl, dispatch }: RouteRequest,
	measure: Measure,
	postcodeText: string,
): ApiResponse => {
	const { measureCompatibilityInventory, geographyResolver } = context;
	if (!measureCompatibilityInventory) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build measure compatibility before answering for a postcode.",
		);
	}
	const found = findPostcode(context, postcodeText);
	if ("status" in found) return found;
	const { record, source: postcodeSource } = found;
	const period = parsedUrl.searchParams.get("period")?.trim() || undefined;
	const geography =
		parsedUrl.searchParams.get("geography")?.trim() || undefined;
	const boundaryYearText = parsedUrl.searchParams.get("boundaryYear");
	const boundaryYear =
		boundaryYearText === null ? undefined : Number(boundaryYearText);
	if (
		boundaryYear !== undefined &&
		(!/^\d{4}$/.test(boundaryYearText!) || !Number.isInteger(boundaryYear))
	) {
		return problem(
			400,
			"Invalid Query",
			"boundaryYear must be a four-digit year.",
		);
	}
	if (!record.centroid) {
		return problem(
			422,
			"Postcode Not Placed",
			`The ${postcodeSource.title} gives ${record.postcode} no grid reference, so it cannot be placed in any area.`,
		);
	}
	const sources = postcodeSources(measure, period, boundaryYear);
	const available = sources.map((source) => ({
		source,
		releases: sourceReleases(
			measureCompatibilityInventory,
			measure.id,
			source,
		),
	}));
	const askFor = (other: (typeof available)[number]) => {
		const query = new URLSearchParams({ postcode: record.postcode });
		if (period) query.set("period", period);
		query.set("geography", other.source.sourceGeography.type);
		return {
			geography: other.source.sourceGeography.type,
			boundaryYear: other.source.sourceGeography.boundaryYear,
			ask: `/v1/data/${measure.id}/value?${query}`,
		};
	};
	// The finest geography holds the most areas in the release it is placed in.
	const areaCount = (entry: (typeof available)[number]) => {
		const release = entry.releases[0];
		return release
			? (geographyResolver.releaseAreas(
					entry.source.sourceGeography.type,
					release.boundaryRelease,
				)?.size ?? 0)
			: -1;
	};
	const published = [
		...new Set(
			measure.sources.map((source) => source.sourceGeography.type),
		),
	].join(", ");
	const requested = geography
		? available.filter(
				(entry) => entry.source.sourceGeography.type === geography,
			)
		: available;
	if (requested.length === 0) {
		return problem(
			422,
			"Place Not Served",
			geography
				? `${measure.id} is not published for ${geography}${period ? ` in ${period}` : ""}${boundaryYear ? ` on ${boundaryYear} boundaries` : ""}; it is published for ${published}.`
				: `${measure.id} has no source${period ? ` for ${period}` : ""}${boundaryYear ? ` on ${boundaryYear} boundaries` : ""}; GET /v1/measures/${measure.id} lists its periods.`,
		);
	}
	// A source is only tried where it covers the postcode's country; the rest
	// are tried finest first, and a coarser one only when a finer cannot answer.
	const country = countryOfCode(record.country);
	const passedOver: Array<{
		geography: string;
		boundaryYear: number;
		reason: string;
	}> = [];
	const candidates = [...requested]
		.sort((left, right) => areaCount(right) - areaCount(left))
		.filter((entry) => {
			if (
				!country ||
				(entry.source.coverage.countries as string[]).includes(country)
			)
				return true;
			passedOver.push({
				...entry.source.sourceGeography,
				geography: entry.source.sourceGeography.type,
				reason: `${measure.id} for ${entry.source.sourceGeography.type} covers ${entry.source.coverage.countries.join(", ")}, and ${record.postcode} is in ${country}.`,
			});
			return false;
		});
	const point = postcodeLookupPoint(record.centroid);
	let attempt: SourceAttempt | undefined;
	for (const candidate of candidates) {
		attempt = attemptSource(
			context,
			measure,
			candidate.source,
			candidate.releases,
			point,
			record.postcode,
			period,
			dispatch,
		);
		if (attempt.outcome !== "unserved") break;
		passedOver.push({
			...candidate.source.sourceGeography,
			geography: candidate.source.sourceGeography.type,
			reason: attempt.reason,
		});
	}
	const describePassed = passedOver.map(
		({ geography: passed, boundaryYear: year, reason }) => ({
			geography: passed,
			boundaryYear: year,
			reason,
		}),
	);
	if (!attempt || attempt.outcome === "unserved") {
		return problem(
			422,
			"Place Not Served",
			`No geography ${measure.id} is published for (${published}) answers for ${record.postcode}. Each candidate below says why.`,
			{ candidates: describePassed },
		);
	}
	const sourceGeography = attempt.source.sourceGeography;
	if (attempt.outcome === "ambiguous") {
		return problem(
			409,
			"Ambiguous Place",
			`${record.postcode}'s centroid lies on the boundary between ${attempt.choices.length} ${sourceGeography.type} areas that ${measure.id} answers. Each choice carries its answer.`,
			{
				code: "ambiguous_place",
				choices: attempt.choices.map((entry) => ({
					area: entry.match.id,
					name: entry.match.name,
					answer: { ...entry.answer, unit: measure.unit },
					via: entry.via,
				})),
			},
		);
	}
	const { match, answer, via, result, release } = attempt;
	const chosen = available.find((entry) => entry.source === attempt.source)!;
	return {
		status: 200,
		body: envelope(releaseId, {
			measure: {
				id: measure.id,
				label: measure.label,
				valueKind: measure.valueKind,
				unit: measure.unit,
			},
			question: {
				postcode: record.postcode,
				period: period ?? null,
				geography: geography ?? null,
			},
			answer: { ...answer, unit: measure.unit },
			area: {
				id: match.id,
				geography: sourceGeography.type,
				code: match.code,
				name: match.name,
				boundaryYear: sourceGeography.boundaryYear,
				containment: match.containment,
				distanceToBoundaryM: match.distanceToBoundaryM,
				nearBoundary: match.nearBoundary,
				positionalToleranceM: result.positionalToleranceM,
			},
			method: "postcode-centroid-in-source-area",
			// The release the centroid was tested against, and how completely
			// it holds the codes the measure was published for.
			boundaryMatch: {
				boundaryRelease: release.boundaryRelease,
				status: release.status,
				matchedSourceShare: release.matchedSourceShare,
			},
			postcode: record,
			point,
			via,
			otherGeographies: available
				.filter((entry) => entry !== chosen)
				.map(askFor),
			...(describePassed.length > 0
				? { passedOver: describePassed }
				: {}),
			...(record.centroid.positionalQuality.accuracyM === null
				? { caution: UNDECLARED_POSTCODE_ACCURACY }
				: {}),
			source: postcodeSource,
			note: [
				answer.periodDefaulted
					? `No period was given, so the latest published, ${answer.period}, was used.`
					: undefined,
				geography
					? undefined
					: `No geography was given, so the finest ${measure.id} answers here, ${sourceGeography.type}, was used; otherGeographies lists the others${describePassed.length > 0 ? " and passedOver says why finer ones did not answer" : ""}.`,
				`The postcode was placed in ${sourceGeography.type} areas as drawn for the data's ${sourceGeography.boundaryYear} boundaries, not today's.`,
				match.nearBoundary
					? "The centroid lies near the area's edge, so a neighbouring area's value may be the right one for some addresses."
					: undefined,
				POSTCODE_NOTE,
				CONTAINMENT_NOTE,
			]
				.filter(Boolean)
				.join(" "),
		}),
	};
};
