import type { AreaLookup } from "./areaInventory";
import type { NamedLocationInventory } from "./namedLocations";
import {
	createPlaceIndex,
	type PlaceCandidate,
	type PlaceIndex,
} from "./placeResolver";
import type { Attempt } from "./placeValue";

/**
 * The place index is built from the whole compiled area inventory, some eighty
 * thousand places, which takes the better part of a second. It is built on the
 * first request that needs it and kept for as long as that inventory is.
 */
const placeIndexes = new WeakMap<
	object,
	{ locations: unknown; index: PlaceIndex }
>();

export const placeIndexFor = (
	areaLookup: AreaLookup,
	namedLocationInventory: NamedLocationInventory | undefined,
) => {
	const cached = placeIndexes.get(areaLookup);
	if (cached && cached.locations === namedLocationInventory) {
		return cached.index;
	}
	const index = createPlaceIndex(areaLookup, namedLocationInventory);
	placeIndexes.set(areaLookup, { locations: namedLocationInventory, index });
	return index;
};

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
