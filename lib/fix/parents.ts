import Papa from "papaparse";
import {
	compareReleasesNewestFirst,
	geographyLabel,
	releaseLabel,
	sameRelease,
} from "./releases";
import type { Successor } from "./successors";
import type {
	BoundaryRelease,
	BulkLookup,
	Crosswalk,
	ReleaseRef,
} from "./types";

/**
 * The larger areas a release's areas sit in, read from the API's published
 * crosswalks. Only crosswalks that give each area one place to go are
 * offered; ones that share an area out by weight convert counts instead.
 */

/** Crosswalks that put each area in a larger one, best first. */
const METHODS = [
	"clean-containment",
	"official-lookup",
	"geometric-containment",
	"best-fit",
];

export interface ParentChoice {
	/** The crosswalk id. */
	id: string;
	to: ReleaseRef;
	method: string;
	label: string;
	/** Header stem, such as "local_authority". */
	header: string;
	/** Where the lookup's CSV downloads from. */
	href: string;
	bytes: number;
}

/** "localAuthority" becomes "local_authority". */
const snake = (geography: string) =>
	geography.replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();

/** The parent columns a release's areas can be given, one per target release. */
export function parentChoices(
	from: ReleaseRef,
	crosswalks: Crosswalk[],
	lookups: BulkLookup[],
	releases: BoundaryRelease[],
): ParentChoice[] {
	const csvOf = new Map(
		lookups
			.filter((lookup) => lookup.formats.csv)
			.map((lookup) => [lookup.source.artifact, lookup.formats.csv!]),
	);
	const best = new Map<string, Crosswalk>();
	for (const crosswalk of crosswalks) {
		if (!sameRelease(crosswalk.from, from)) continue;
		if (crosswalk.to.geography === from.geography) continue;
		if (!METHODS.includes(crosswalk.method)) continue;
		if (!csvOf.has(crosswalk.artifact)) continue;
		const key = `${crosswalk.to.geography}/${crosswalk.to.boundaryRelease}`;
		const held = best.get(key);
		if (
			!held ||
			METHODS.indexOf(crosswalk.method) < METHODS.indexOf(held.method)
		)
			best.set(key, crosswalk);
	}

	const chosen = [...best.values()].sort(
		(a, b) =>
			geographyLabel(releases, a.to.geography).localeCompare(
				geographyLabel(releases, b.to.geography),
			) ||
			compareReleasesNewestFirst(
				a.to.boundaryRelease,
				b.to.boundaryRelease,
			),
	);
	const perGeography = new Map<string, number>();
	for (const crosswalk of chosen)
		perGeography.set(
			crosswalk.to.geography,
			(perGeography.get(crosswalk.to.geography) ?? 0) + 1,
		);

	return chosen.map((crosswalk) => {
		const csv = csvOf.get(crosswalk.artifact)!;
		const stem = snake(crosswalk.to.geography);
		return {
			id: crosswalk.id,
			to: crosswalk.to,
			method: crosswalk.method,
			label: releaseLabel(releases, crosswalk.to),
			// Two releases of one geography need telling apart.
			header:
				(perGeography.get(crosswalk.to.geography) ?? 0) > 1
					? `${stem}_${crosswalk.to.boundaryRelease.slice(0, 7).replace("-", "_")}`
					: stem,
			href: csv.href,
			bytes: csv.bytes,
		};
	});
}

/** A crosswalk lookup's CSV, as each source code's parent areas. */
export function readParentLookup(csv: string): Map<string, Successor[]> {
	const parsed = Papa.parse<Record<string, string>>(csv, {
		header: true,
		skipEmptyLines: true,
	});
	const lookup = new Map<string, Successor[]>();
	for (const row of parsed.data) {
		const source = row.sourceCode?.trim();
		const target = row.targetCode?.trim();
		if (!source || !target) continue;
		const parents = lookup.get(source) ?? [];
		if (!parents.some((parent) => parent.code === target))
			parents.push({
				code: target,
				// Labels are a list; the first is the area's name.
				name: row.targetLabels?.split("|")[0]?.trim() || target,
			});
		lookup.set(source, parents);
	}
	return lookup;
}
