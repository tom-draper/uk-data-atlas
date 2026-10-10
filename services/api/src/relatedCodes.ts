import type { AreaLookup } from "./areaInventory";
import type { CrosswalkArtifact } from "./crosswalkInventory";
import { releaseKey } from "./geographyKeys";

/**
 * The codes a crosswalk relates, on each side of it. A record with no targets
 * relates its source to nothing, so that source is not named, though the
 * crosswalk lists it. These are the areas an area relationship index answers
 * for, which is all a count of related areas needs.
 */
export const relatedCodesOf = (
	crosswalk: Pick<CrosswalkArtifact, "records">,
) => {
	const source = new Set<string>();
	const target = new Set<string>();
	for (const record of crosswalk.records) {
		if (record.targets.length > 0) source.add(record.source.code);
		for (const { code } of record.targets) target.add(code);
	}
	return { source, target };
};

/** The codes related in each release, by `releaseKey`. */
export type RelatedCodesByRelease = Map<string, Set<string>>;

/** Add the codes one crosswalk relates to the release on each side of it. */
export const addRelatedCodes = (
	related: RelatedCodesByRelease,
	crosswalk: CrosswalkArtifact,
) => {
	const { source, target } = relatedCodesOf(crosswalk);
	for (const [side, codes] of [
		[crosswalk.from, source],
		[crosswalk.to, target],
	] as const) {
		const key = releaseKey(side.geography, side.boundaryRelease);
		let held = related.get(key);
		if (!held) related.set(key, (held = new Set()));
		for (const code of codes) held.add(code);
	}
};

/** How many of a compiled release's areas a crosswalk relates to another. */
export type ReleaseCoverage = {
	geography: string;
	boundaryRelease: string;
	areaCount: number;
	relatedAreaCount: number;
};

/**
 * Each compiled release's related areas counted, in release order. A code a
 * crosswalk names that the release does not hold is not an area of it, so it
 * is not counted.
 */
export const releaseCoverageOf = (
	related: RelatedCodesByRelease,
	areaLookup: AreaLookup,
): ReleaseCoverage[] =>
	[...areaLookup.keys()].sort().map((key) => {
		const [geography, boundaryRelease] = key.split("/", 2) as [
			string,
			string,
		];
		const areas = areaLookup.get(key)!;
		const codes = related.get(key);
		let relatedAreaCount = 0;
		if (codes)
			for (const code of areas.keys())
				if (codes.has(code)) relatedAreaCount += 1;
		return {
			geography,
			boundaryRelease,
			areaCount: areas.size,
			relatedAreaCount,
		};
	});
