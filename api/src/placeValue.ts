import type { Measure } from "./dataCatalog";
import type { PlaceCandidate } from "./placeResolver";

/**
 * Answering "what is this measure for this place?" from a name.
 *
 * Nothing here computes a value. Each candidate the name could mean is put to
 * the route that already serves that kind of place, series for an area and
 * aggregate for a curated location or a country, so every rule and refusal
 * those routes apply holds here unchanged. What this adds is the choice of
 * candidate, made by asking which of them the measure can answer rather than by
 * guessing which the caller meant.
 */

export type Dispatch = (url: string) => {
	status: number;
	body: unknown;
};

type Answer = {
	period: string;
	periodDefaulted: boolean;
	status: string;
	value?: number;
	category?: string;
	confidenceInterval?: { lower: number; upper: number };
};

export type Attempt =
	| {
			candidate: PlaceCandidate;
			served: true;
			method: "source-exact" | "aggregate";
			via: string;
			answer: Answer;
			/**
			 * The partition, period and area codes the answer rests on. Two
			 * candidates with the same key are the same ground reached two ways,
			 * such as Manchester the authority and Manchester the curated
			 * location of that one authority.
			 */
			ground: string;
	  }
	| { candidate: PlaceCandidate; served: false; reason: string };

const COUNTRY_CODES = new Set([
	"E92000001",
	"W92000004",
	"S92000003",
	"N92000002",
]);

const detailOf = (body: unknown) =>
	(body as { detail?: string } | undefined)?.detail ?? "Not served.";

/** Newest boundary year first, so the current codes are tried before older ones. */
const newestFirst = (sources: Measure["sources"]) =>
	[...sources].sort(
		(left, right) =>
			right.sourceGeography.boundaryYear -
			left.sourceGeography.boundaryYear,
	);

const seriesAttempt = (
	measure: Measure,
	candidate: PlaceCandidate,
	period: string | undefined,
	dispatch: Dispatch,
): Attempt => {
	const sources = newestFirst(
		measure.sources.filter(
			(source) => source.sourceGeography.type === candidate.geography,
		),
	);
	if (sources.length === 0) {
		return {
			candidate,
			served: false,
			reason: `${measure.id} is not published for ${candidate.geography} areas.`,
		};
	}
	let lastReason = "";
	for (const source of sources) {
		const { type, boundaryYear } = source.sourceGeography;
		const via = `/v1/data/${measure.id}/series?areaCode=${encodeURIComponent(candidate.code)}&geography=${type}&boundaryYear=${boundaryYear}`;
		const response = dispatch(via);
		if (response.status !== 200) {
			lastReason = detailOf(response.body);
			continue;
		}
		const series = (
			response.body as {
				data: { series: (Answer & { areaCode: string })[] };
			}
		).data.series;
		const entry = period
			? series.find((point) => point.period === period)
			: series.at(-1);
		if (!entry) {
			lastReason = period
				? `${candidate.code} has no ${measure.id} for ${period}; published: ${series.map((point) => point.period).join(", ")}.`
				: `${candidate.code} has no ${measure.id} observations.`;
			continue;
		}
		const { areaCode: _areaCode, ...answer } = entry;
		return {
			candidate,
			served: true,
			method: "source-exact",
			via,
			answer: { ...answer, periodDefaulted: !period },
			ground: `${type}@${boundaryYear}:${entry.period}:${candidate.code}`,
		};
	}
	return { candidate, served: false, reason: lastReason };
};

const aggregateAttempt = (
	measure: Measure,
	candidate: PlaceCandidate,
	period: string | undefined,
	dispatch: Dispatch,
): Attempt => {
	const memberGeography =
		candidate.kind === "named-location"
			? candidate.memberGeography
			: "localAuthority";
	if (!memberGeography) {
		return {
			candidate,
			served: false,
			reason: "The named location does not declare the geography of its member codes.",
		};
	}
	// A named location is summed from its declared base geography; a country is
	// summed from local authorities.
	const [source] = newestFirst(
		measure.sources.filter(
			(candidateSource) =>
				candidateSource.sourceGeography.type === memberGeography,
		),
	);
	if (!source) {
		return {
			candidate,
			served: false,
			reason: `${measure.id} is not published for ${memberGeography}, which this ${candidate.kind === "named-location" ? "curated location" : "country"} is summed from.`,
		};
	}
	const chosen = period ?? source.periods.at(-1)!;
	if (!source.periods.includes(chosen)) {
		return {
			candidate,
			served: false,
			reason: `${measure.id} has no ${chosen} for ${memberGeography}; published: ${source.periods.join(", ")}.`,
		};
	}
	const { boundaryYear } = source.sourceGeography;
	const selector =
		candidate.kind === "named-location"
			? `locationId=${encodeURIComponent(candidate.code)}`
			: `areaCode=${encodeURIComponent(candidate.code)}`;
	const via = `/v1/data/${measure.id}/aggregate?${selector}&geography=${memberGeography}&boundaryYear=${boundaryYear}&period=${encodeURIComponent(chosen)}`;
	const response = dispatch(via);
	if (response.status !== 200) {
		return { candidate, served: false, reason: detailOf(response.body) };
	}
	const data = (
		response.body as {
			data: {
				record: { value: number; status: string };
				aggregation: {
					memberCodesNotInPartition?: {
						otherVintage: string[];
						legacyAliases: string[];
					};
				};
			};
		}
	).data;
	const skipped = new Set([
		...(data.aggregation.memberCodesNotInPartition?.otherVintage ?? []),
		...(data.aggregation.memberCodesNotInPartition?.legacyAliases ?? []),
	]);
	const contributing =
		candidate.kind === "named-location"
			? (candidate.memberCodes ?? []).filter((code) => !skipped.has(code))
			: [`country:${candidate.code}`];
	return {
		candidate,
		served: true,
		method: "aggregate",
		via,
		answer: {
			period: chosen,
			periodDefaulted: !period,
			status: data.record.status,
			value: data.record.value,
		},
		ground: `${memberGeography}@${boundaryYear}:${chosen}:${[...contributing].sort().join(",")}`,
	};
};

export const attemptPlace = (
	measure: Measure,
	candidate: PlaceCandidate,
	period: string | undefined,
	dispatch: Dispatch,
): Attempt =>
	candidate.kind === "named-location" ||
	(candidate.geography === "country" && COUNTRY_CODES.has(candidate.code))
		? aggregateAttempt(measure, candidate, period, dispatch)
		: seriesAttempt(measure, candidate, period, dispatch);

export type PlaceValueOutcome =
	| {
			outcome: "answered";
			chosen: Attempt & { served: true };
			attempts: Attempt[];
	  }
	| {
			outcome: "ambiguous";
			choices: (Attempt & { served: true })[];
			attempts: Attempt[];
	  }
	| { outcome: "unserved"; attempts: Attempt[] }
	| { outcome: "unmatched" };

const tierOf = (candidate: PlaceCandidate) =>
	candidate.match === "prefix" ? 1 : 0;

/**
 * Pick the answer a name gives, or say why there is not exactly one.
 *
 * Candidates matching the name exactly are tried first, and ones that merely
 * begin with it only when no exact candidate can be answered. Answers resting on
 * the same partition, period and area codes are the same ground and count once.
 * One distinct answer is returned; more than one is ambiguity, and every choice
 * is handed back with its value so the caller can pick by what it knows.
 */
export const valueForPlace = (
	measure: Measure,
	candidates: PlaceCandidate[],
	period: string | undefined,
	dispatch: Dispatch,
): PlaceValueOutcome => {
	if (candidates.length === 0) return { outcome: "unmatched" };
	const attempts: Attempt[] = [];
	for (const tier of [0, 1]) {
		const inTier = candidates.filter(
			(candidate) => tierOf(candidate) === tier,
		);
		const tried = inTier.map((candidate) =>
			attemptPlace(measure, candidate, period, dispatch),
		);
		attempts.push(...tried);
		// Where the same ground is reached twice, keep the source-exact reading:
		// it is the publisher's observation, where the aggregate of one member is
		// the same number relabelled as derived.
		const byGround = new Map<string, Attempt & { served: true }>();
		for (const attempt of tried) {
			if (!attempt.served) continue;
			const existing = byGround.get(attempt.ground);
			if (
				!existing ||
				(existing.method === "aggregate" &&
					attempt.method === "source-exact")
			) {
				byGround.set(attempt.ground, attempt);
			}
		}
		const distinct = [...byGround.values()];
		if (distinct.length === 1) {
			return { outcome: "answered", chosen: distinct[0]!, attempts };
		}
		if (distinct.length > 1) {
			return { outcome: "ambiguous", choices: distinct, attempts };
		}
	}
	return { outcome: "unserved", attempts };
};
