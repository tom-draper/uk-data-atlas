import {
	ATLAS_LOCATIONS,
	ATLAS_MAPS,
	type AtlasLocation,
	type AtlasMap,
} from "@/lib/atlas/pages";
import { atlasMapSections } from "@/lib/atlas/mapSections";
import { hasRankingFor } from "@/lib/atlas/rankingPages";
import { rankedPeriods, rankingKey } from "@/lib/atlas/rankings";

/**
 * A place's page links to every place within it, unless there are more than
 * this many (England's hundreds of councils): then to the biggest few.
 */
const ALL_NARROWER = 40;
const FEW_NARROWER = 12;

/**
 * Whether `outer` covers all of `inner`, and more. A nation, or the UK, names
 * no councils, so it covers whatever lies in its countries.
 */
export function covers(outer: AtlasLocation, inner: AtlasLocation) {
	if (outer.slug === inner.slug) return false;
	if (outer.members.length === 0)
		return (
			inner.countries.every((country) =>
				outer.countries.includes(country),
			) &&
			(inner.members.length > 0 ||
				inner.countries.length < outer.countries.length)
		);
	if (inner.members.length === 0) return false;
	const members = new Set(outer.members);
	return (
		outer.members.length > inner.members.length &&
		inner.members.every((code) => members.has(code))
	);
}

/** Bigger first: a nation by its countries, else by its councils. */
const size = (location: AtlasLocation) =>
	location.members.length === 0
		? 10_000 * location.countries.length
		: location.members.length;

const bySize = (left: AtlasLocation, right: AtlasLocation) =>
	size(right) - size(left) || left.name.localeCompare(right.name, "en-GB");

const narrowest = (places: AtlasLocation[]) =>
	places.length > ALL_NARROWER ? places.slice(0, FEW_NARROWER) : places;

/**
 * The same map ranked for the places around this one: every place that
 * covers it, and the places it covers.
 */
export function rankingsElsewhere(
	location: AtlasLocation,
	map: AtlasMap,
	period?: number,
) {
	const key = rankingKey(map, period);
	const ranked = ATLAS_LOCATIONS.filter((other) =>
		hasRankingFor(other.slug, key),
	);
	return {
		wider: ranked.filter((other) => covers(other, location)).sort(bySize),
		narrower: narrowest(
			ranked.filter((other) => covers(location, other)).sort(bySize),
		),
	};
}

/** The other maps ranked for this place, under the chart panel's sections. */
export const otherRankings = (location: AtlasLocation, map: AtlasMap) =>
	atlasMapSections(
		ATLAS_MAPS.filter(
			(other) =>
				other.slug !== map.slug &&
				hasRankingFor(location.slug, other.slug),
		),
	);

/** The map's other periods ranked for this place, latest first. */
export const otherPeriods = (
	location: AtlasLocation,
	map: AtlasMap,
	period?: number,
) =>
	rankedPeriods(map).filter(
		(other) =>
			rankingKey(map, other) !== rankingKey(map, period) &&
			hasRankingFor(location.slug, rankingKey(map, other)),
	);
