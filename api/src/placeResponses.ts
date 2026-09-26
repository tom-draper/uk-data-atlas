import type { PlaceCandidate } from "./placeResolver";
import type { Attempt } from "./placeValue";

export const describeCandidate = (candidate: PlaceCandidate) => ({
	place: candidate.place,
	kind: candidate.kind,
	name: candidate.name,
	geography: candidate.geography,
	code: candidate.code,
	match: candidate.match,
	...(candidate.matchedLabel !== candidate.name
		? { matchedLabel: candidate.matchedLabel }
		: {}),
	...(candidate.definitionRevision
		? { definitionRevision: candidate.definitionRevision }
		: {}),
	...(candidate.validity ? { validity: candidate.validity } : {}),
});

export const describeAttempt = (attempt: Attempt) =>
	attempt.served
		? {
				...describeCandidate(attempt.candidate),
				served: true,
				method: attempt.method,
				answer: attempt.answer,
				via: attempt.via,
			}
		: {
				...describeCandidate(attempt.candidate),
				served: false,
				reason: attempt.reason,
			};
